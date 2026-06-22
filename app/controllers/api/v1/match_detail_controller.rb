module Api
  module V1
    class MatchDetailController < BaseController
      def show
        raw_id = params[:id].to_s
        client = LiveScoresClient.new

        # db-{id} — direct DB lookup (WC matches navigated from the HOY widget)
        if raw_id.start_with?("db-")
          db_id = raw_id.sub("db-", "").to_i
          match = Match.includes(:home_team, :away_team, :goals, { match_stats: :team }, :competition).find_by(id: db_id)
          return render json: { fixture: nil, error: "not_found", stats: [], events: [], lineups: [] } unless match

          # Try to resolve the real API-Football fixture so lineups, stats, ratings, etc. work.
          if match.home_team && match.away_team && match.kickoff_at
            resolved = ApiSportsClient.new.match_detail(
              home_name:  match.home_team.name,
              away_name:  match.away_team.name,
              kickoff_at: match.kickoff_at,
            )
            if resolved&.dig(:fixture, "teams").present?
              sync_db_from_resolved(match, resolved)
              resolved[:fixture]["fixture"]["db_id"] = match.id
              return render json: resolved
            end
          end

          data = local_match_as_fixture(match)
          data[:fixture]["fixture"]["db_id"] = match.id
          return render json: data
        end

        external_id = raw_id.sub(/\Aext-/, "").to_i

        local_match = Match.includes(:home_team, :away_team, :goals, { match_stats: :team }, :competition)
                           .find_by(external_id: external_id)

        data = client.match_detail(external_id)

        # If the API returned a match but the team names don't match the local DB record,
        # the external_id is still in the old namespace (football-data.org). Fall back to
        # local data until sync_external_ids_from_api_football updates the IDs.
        if local_match && data&.dig(:fixture, "teams").present?
          api_home = data.dig(:fixture, "teams", "home", "name").to_s.downcase
          api_away = data.dig(:fixture, "teams", "away", "name").to_s.downcase
          db_home  = local_match.home_team&.name.to_s.downcase
          db_away  = local_match.away_team&.name.to_s.downcase

          # Allow for minor name differences (e.g. "Korea Republic" vs "South Korea")
          names_match = api_home.split.any? { |w| db_home.include?(w) } &&
                        api_away.split.any? { |w| db_away.include?(w) }

          unless names_match
            # ID namespace mismatch (football-data.org vs API-Football).
            # Try to resolve the correct fixture via team-name + kickoff search.
            if local_match.home_team && local_match.away_team && local_match.kickoff_at
              resolved = ApiSportsClient.new.match_detail(
                home_name:  local_match.home_team.name,
                away_name:  local_match.away_team.name,
                kickoff_at: local_match.kickoff_at,
              )
              if resolved&.dig(:fixture, "teams").present?
                sync_db_from_resolved(local_match, resolved)
                resolved[:fixture]["fixture"]["db_id"] = local_match.id
                broadcast_if_changed(external_id, resolved, local_match: local_match)
                return render json: resolved
              end
            end
            # ApiSportsClient also failed — serve local DB data as last resort
            data = local_match_as_fixture(local_match)
            data[:fixture]["fixture"]["db_id"] = local_match.id
            return render json: data
          end
        end

        # API returned nothing — fall back to local DB, then cached list data
        if data.nil? || data[:fixture].nil?
          if local_match
            data = local_match_as_fixture(local_match)
            data[:fixture]["fixture"]["db_id"] = local_match.id
            return render json: data
          end
          data = client.match_from_list(external_id)
          return render json: { fixture: nil, error: "not_found", stats: [], events: [], lineups: [] } unless data
        end

        # Try fallback whenever stats are missing — even if events/lineups exist.
        data = api_sports_fallback(data) if data[:fixture].present? && data[:stats].to_a.empty?

        # Inject db_id so frontend can call AI summary endpoint
        if local_match && data[:fixture].is_a?(Hash)
          data[:fixture]["fixture"] ||= {}
          data[:fixture]["fixture"]["db_id"] = local_match.id
        end

        broadcast_if_changed(external_id, data, local_match: local_match)
        render json: data
      rescue => e
        Rails.logger.error("[MatchDetailController] #{e.message}")
        render json: { fixture: nil, error: "api_error", stats: [], events: [], lineups: [] }
      end

      private

      def api_sports_fallback(data)
        home    = data.dig(:fixture, "teams", "home", "name")
        away    = data.dig(:fixture, "teams", "away", "name")
        kickoff = data.dig(:fixture, "fixture", "date")
        return data unless home && away && kickoff

        fallback = ApiSportsClient.new.match_detail(
          home_name: home, away_name: away, kickoff_at: kickoff
        )
        return data unless fallback

        Rails.logger.info("[MatchDetail] using API-Sports fallback for #{home} vs #{away}")

        # Only fill in missing pieces — never overwrite data we already have.
        merged = data.dup
        merged[:events]  = fallback[:events]  if data[:events].to_a.empty?  && fallback[:events].to_a.any?
        merged[:stats]   = fallback[:stats]   if data[:stats].to_a.empty?   && fallback[:stats].to_a.any?
        merged[:lineups] = fallback[:lineups] if data[:lineups].to_a.empty? && fallback[:lineups].to_a.any?
        merged[:h2h]     = fallback[:h2h]     if fallback[:h2h].present?
        merged[:source]  = "api_sports_fallback"
        merged
      rescue => e
        Rails.logger.warn("[MatchDetail] api_sports_fallback failed: #{e.message}")
        data
      end

      # Write API-Football result back to the local DB record so the HOY widget
      # and standings reflect the real score without waiting for WorldCupSync.
      def sync_db_from_resolved(match, resolved)
        fx           = resolved.dig(:fixture, "fixture") || {}
        status_short = fx.dig("status", "short")
        api_status   = LiveScoresClient::STATUS_MAP[status_short]
        api_home     = resolved.dig(:fixture, "goals", "home")
        api_away     = resolved.dig(:fixture, "goals", "away")
        api_ext_id   = fx["id"]

        updates = {}
        updates[:status]      = api_status  if api_status.present?  && match.status != api_status
        updates[:home_score]  = api_home    if api_home.present?     && match.home_score != api_home
        updates[:away_score]  = api_away    if api_away.present?     && match.away_score != api_away
        updates[:external_id] = api_ext_id  if api_ext_id.present?   && match.external_id != api_ext_id

        match.update_columns(updates) if updates.any?
      rescue => e
        Rails.logger.warn("[MatchDetail#sync_db] #{e.message}")
      end

      def broadcast_if_changed(fixture_id, data, local_match: nil)
        return unless data[:fixture]
        # data[:fixture] is a string-keyed hash from LiveScoresClient/build_fixture
        status = data.dig(:fixture, "fixture", "status", "short")
        return unless %w[1H 2H HT ET BT P].include?(status)

        cache_key = "ext_match_bcast_#{fixture_id}"
        prev = Rails.cache.read(cache_key)

        current = {
          h:      data.dig(:fixture, "goals", "home"),
          a:      data.dig(:fixture, "goals", "away"),
          s:      status,
          events: data[:events]&.length.to_i
        }

        score_changed = prev.present? && (prev[:h] != current[:h] || prev[:a] != current[:a])

        # Also consider the score stale when API differs from DB — catches the case
        # where no one has viewed the detail page since the goal, so prev is nil.
        db_stale = local_match && current[:h] && current[:a] &&
                   (local_match.home_score.to_i != current[:h] || local_match.away_score.to_i != current[:a])

        if prev.nil? || score_changed || prev[:events] != current[:events]
          ActionCable.server.broadcast("external_match_#{fixture_id}", {
            type:    "match_update",
            fixture: data[:fixture],
            events:  data[:events],
            stats:   data[:stats],
            lineups: data[:lineups]
          })
        end

        # When the API shows a new score, sync it immediately to the list view
        # (TodayPage/HomePage) without waiting for the next WorldCupSync cycle.
        # Triggers on score_changed (subsequent loads) OR db_stale (first load after a goal).
        if (score_changed || db_stale) && local_match && current[:h] && current[:a]
          minute = data.dig(:fixture, "fixture", "status", "elapsed")
          ActionCable.server.broadcast("live_scores", {
            type:        "live_score_update",
            match_id:    local_match.id,
            external_id: fixture_id,
            home_score:  current[:h],
            away_score:  current[:a],
            status:      "live",
            minute:      minute
          })
          local_match.update_columns(home_score: current[:h], away_score: current[:a])
          Rails.logger.info("[MatchDetail] patched DB + list for #{fixture_id}: #{current[:h]}–#{current[:a]}")

          # Fire push notification here because update_columns above means
          # sync_match_from_live will see score_unchanged=true and skip it.
          # Use an atomic dedup key shared with the sync job — whichever sees
          # the score change first fires the notification, the other skips.
          if local_match.competition&.code == "WC"
            dedup = "goal_notified_#{local_match.id}_#{current[:h]}_#{current[:a]}"
            if Rails.cache.write(dedup, true, expires_in: 5.minutes, unless_exist: true)
              # Events use symbol keys from LiveScoresClient#normalize_events
              scorer_name = data[:events]
                &.select { |e| (e[:type] || e["type"]) == "Goal" && (e[:detail] || e["detail"]) != "Own Goal" }
                &.last&.then { |e| e[:player] || e.dig("player", "name") }.presence
              MatchEventNotificationJob.perform_later(
                event_type: "goal",
                match_id:   local_match.id,
                home_name:  local_match.home_team&.name.to_s,
                away_name:  local_match.away_team&.name.to_s,
                home_score: current[:h].to_i,
                away_score: current[:a].to_i,
                minute:     minute,
                scorer:     scorer_name,
                match_url:  "/matches/#{fixture_id}"
              )
            end
          end
        end

        Rails.cache.write(cache_key, current, expires_in: 30.seconds)
      rescue => e
        Rails.logger.warn("[MatchDetail#broadcast] #{e.message}")
      end

      def local_match_as_fixture(match)
        home = match.home_team
        away = match.away_team

        status_map = {
          "finished"  => { "short" => "FT",  "long" => "Match Finished",  "elapsed" => 90 },
          "live"      => { "short" => "1H",  "long" => "First Half",      "elapsed" => nil },
          "scheduled" => { "short" => "NS",  "long" => "Not Started",     "elapsed" => nil }
        }
        status = status_map.fetch(match.status, { "short" => "NS", "long" => match.status&.humanize, "elapsed" => nil })

        home_wins = match.status == "finished" && match.home_score.to_i > match.away_score.to_i
        away_wins = match.status == "finished" && match.away_score.to_i > match.home_score.to_i

        comp = match.competition
        round_label = [ match.group_stage.presence && "Group Stage - Group #{match.group_stage}",
                       match.round.presence ].compact.first

        fixture = {
          "fixture" => {
            "id"     => match.external_id || match.id,
            "db_id"  => match.id,
            "date"   => match.kickoff_at&.iso8601,
            "status" => status,
            "venue"  => { "name" => match.venue, "city" => nil }
          },
          "league" => {
            "id"      => comp&.external_id,
            "name"    => comp&.name || "World Cup 2026",
            "logo"    => comp&.logo,
            "country" => comp&.country,
            "round"   => round_label
          },
          "teams" => {
            "home" => home ? { "id" => home.external_id || home.id, "name" => home.name, "logo" => home.flag_url, "winner" => home_wins }
                           : { "id" => nil, "name" => "TBD", "logo" => nil, "winner" => false },
            "away" => away ? { "id" => away.external_id || away.id, "name" => away.name, "logo" => away.flag_url, "winner" => away_wins }
                           : { "id" => nil, "name" => "TBD", "logo" => nil, "winner" => false }
          },
          "goals" => { "home" => match.home_score, "away" => match.away_score }
        }

        # Build events from goals
        goal_type_map = { "regular" => "Normal Goal", "own_goal" => "Own Goal", "penalty" => "Penalty" }
        events = match.goals.sort_by(&:minute).map do |g|
          team = g.team
          {
            "minute" => g.minute,
            "extra"  => nil,
            "team"   => { "name" => team&.name, "logo" => team&.flag_url },
            "player" => g.player_name,
            "assist" => nil,
            "type"   => "Goal",
            "detail" => goal_type_map.fetch(g.goal_type.to_s, "Normal Goal"),
            "comments" => nil
          }
        end

        # Build stats from match_stats
        stats = match.match_stats.map do |s|
          team = s.team
          {
            "team"       => { "name" => team&.name, "logo" => team&.flag_url },
            "statistics" => [
              { "type" => "Ball Possession",  "value" => s.possession ? "#{s.possession}%" : nil },
              { "type" => "Total Shots",       "value" => s.shots },
              { "type" => "Shots on Goal",     "value" => s.shots_on_target },
              { "type" => "Corner Kicks",      "value" => s.corners },
              { "type" => "Fouls",             "value" => s.fouls },
              { "type" => "Yellow Cards",      "value" => s.yellow_cards },
              { "type" => "Red Cards",         "value" => s.red_cards },
              { "type" => "Offsides",          "value" => s.offsides }
            ].reject { |stat| stat["value"].nil? }
          }
        end

        { fixture: fixture, events: events, stats: stats, lineups: [], source: "local" }
      end

      public

      # GET /api/v1/match_detail/:id/ai_summary?lang=es
      # Generates an AI post-match report for external (API-only) matches.
      # For DB-backed WC matches use GET /api/v1/matches/:id/ai_summary
      # (AiSummariesController) — that path uses AiMatchSummaryService and its
      # own cache key, so the two routes don't duplicate work.
      def ai_summary
        unless ENV["ANTHROPIC_API_KEY"].present?
          return render json: { error: "ai_unavailable" }, status: :service_unavailable
        end

        raw_id      = params[:id].to_s
        lang        = %w[en es fr de it pt].include?(params[:lang]) ? params[:lang] : "en"
        external_id = raw_id.sub(/\Aext-/, "").to_i
        client      = LiveScoresClient.new

        data = client.match_detail(external_id)
        return render json: { error: "not_found" }, status: :not_found if data.nil? || data[:fixture].nil?

        # Must be finished
        status = data.dig(:fixture, "fixture", "status", "short")
        unless %w[FT AET PEN].include?(status)
          return render json: { error: "match_not_finished" }, status: :unprocessable_entity
        end

        cache_key = "ai_summary_ext_#{external_id}_#{lang}"
        result = Rails.cache.fetch(cache_key, expires_in: 24.hours) do
          AiMatchSummaryExternalService.new(data, lang: lang).call
        end

        if result
          render json: result
        else
          Rails.cache.delete(cache_key)
          render json: { error: "generation_failed" }, status: :service_unavailable
        end
      rescue => e
        Rails.logger.error("[MatchDetail#ai_summary] #{e.message}")
        render json: { error: "server_error" }, status: :internal_server_error
      end

      def preview
        home_id = params[:home_team_id].to_i
        away_id = params[:away_team_id].to_i
        render json: { h2h: [], home_form: [], away_form: [] }
      rescue => e
        Rails.logger.error("[MatchDetailController#preview] #{e.message}")
        render json: { h2h: [], home_form: [], away_form: [] }
      end
    end
  end
end
