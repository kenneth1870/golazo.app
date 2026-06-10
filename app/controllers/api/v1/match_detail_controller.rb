module Api
  module V1
    class MatchDetailController < BaseController
      def show
        raw_id = params[:id].to_s
        client = LiveScoresClient.new

        # db-{id} — direct DB lookup (WC matches without an external_id)
        if raw_id.start_with?("db-")
          db_id = raw_id.sub("db-", "").to_i
          match = Match.includes(:home_team, :away_team, :goals, :match_stats, :competition).find_by(id: db_id)
          return render json: { fixture: nil, error: "not_found", stats: [], events: [], lineups: [] } unless match
          return render json: local_match_as_fixture(match)
        end

        external_id = raw_id.sub(/\Aext-/, "").to_i
        data = client.match_detail(external_id)

        # Full detail unavailable — cascade through fallbacks
        if data.nil? || data[:fixture].nil?
          # 1. Local DB (synced matches with external_id)
          match = Match.includes(:home_team, :away_team, :goals, :match_stats, :competition)
                       .find_by(external_id: external_id)
          if match
            data = local_match_as_fixture(match)
            # Merge db_id into fixture so frontend can call AI summary
            data[:fixture]&.dig("fixture")&.merge!("db_id" => match.id)
          else
            # 2. Build a basic fixture from the cached date-list data
            data = client.match_from_list(external_id)
            return render json: { fixture: nil, error: "not_found", stats: [], events: [], lineups: [] } unless data
          end
        end

        # Try fallback whenever stats are missing — even if events/lineups exist.
        # A match can have goal events + lineups but the stats endpoint returns
        # nothing (common for friendlies). The fallback searches by team name
        # and may resolve a different fixture_id that has stats.
        data = api_sports_fallback(data) if data[:fixture].present? && data[:stats].to_a.empty?

        # Inject db_id so frontend can call AI summary endpoint
        local = Match.select(:id).find_by(external_id: external_id)
        if local && data[:fixture].is_a?(Hash)
          data[:fixture]["fixture"] ||= {}
          data[:fixture]["fixture"]["db_id"] = local.id
        end

        broadcast_if_changed(external_id, data)
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

      def broadcast_if_changed(fixture_id, data)
        return unless data[:fixture]
        status = data.dig(:fixture, :fixture, :status, :short)
        return unless %w[1H 2H HT ET BT P].include?(status)

        cache_key = "ext_match_bcast_#{fixture_id}"
        prev = Rails.cache.read(cache_key)

        current = {
          h:      data.dig(:fixture, :goals, :home),
          a:      data.dig(:fixture, :goals, :away),
          s:      status,
          events: data[:events]&.length.to_i
        }

        if prev.nil? || prev[:h] != current[:h] || prev[:a] != current[:a] || prev[:events] != current[:events]
          ActionCable.server.broadcast("external_match_#{fixture_id}", {
            type:    "match_update",
            fixture: data[:fixture],
            events:  data[:events],
            stats:   data[:stats],
            lineups: data[:lineups]
          })
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
            "home" => { "id" => home.external_id || home.id, "name" => home.name, "logo" => home.flag_url, "winner" => home_wins },
            "away" => { "id" => away.external_id || away.id, "name" => away.name, "logo" => away.flag_url, "winner" => away_wins }
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
        stats = match.match_stats.includes(:team).map do |s|
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
      # Generates an AI post-match report for any finished external match.
      # Works for matches that don't exist in our DB (friendlies, leagues, etc.).
      def ai_summary
        unless ENV["ANTHROPIC_API_KEY"].present?
          return render json: { error: "ai_unavailable" }, status: :service_unavailable
        end

        raw_id      = params[:id].to_s
        lang        = params[:lang].to_s.presence || "en"
        external_id = raw_id.sub(/\Aext-/, "").to_i
        client      = LiveScoresClient.new

        data = client.match_detail(external_id)

        # Fallback: check DB for a synced WC match with this external_id
        if data.nil? || data[:fixture].nil?
          match = Match.includes(:home_team, :away_team, :goals, :match_stats, :competition)
                       .find_by(external_id: external_id)
          if match
            result = AiMatchSummaryService.new(match, lang: lang).call
            return result ? render(json: result) : render(json: { error: "generation_failed" }, status: :service_unavailable)
          end
          return render json: { error: "not_found" }, status: :not_found
        end

        # Must be finished
        status = data.dig(:fixture, "fixture", "status", "short")
        unless %w[FT AET PEN].include?(status)
          return render json: { error: "match_not_finished" }, status: :unprocessable_entity
        end

        result = AiMatchSummaryExternalService.new(data, lang: lang).call

        if result
          render json: result
        else
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
