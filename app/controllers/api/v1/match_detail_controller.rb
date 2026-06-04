module Api
  module V1
    class MatchDetailController < BaseController
      def show
        external_id = params[:id].to_s.sub(/\Aext-/, "").to_i
        data = LiveScoresClient.new.match_detail(external_id)

        # External API returned nothing — fall back to local DB
        if data[:fixture].nil?
          match = Match.includes(:home_team, :away_team, :goals, :match_stats, :competition)
                       .find_by(external_id: external_id)

          if match
            data = local_match_as_fixture(match)
          else
            return render json: { fixture: nil, error: "not_found", stats: [], events: [], lineups: [] }
          end
        end

        broadcast_if_changed(external_id, data)
        render json: data
      rescue => e
        Rails.logger.error("[MatchDetailController] #{e.message}")
        render json: { fixture: nil, error: "api_error", stats: [], events: [], lineups: [] }
      end

      private

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
          events: data[:events]&.length.to_i,
        }

        if prev.nil? || prev[:h] != current[:h] || prev[:a] != current[:a] || prev[:events] != current[:events]
          ActionCable.server.broadcast("external_match_#{fixture_id}", {
            type:    "match_update",
            fixture: data[:fixture],
            events:  data[:events],
            stats:   data[:stats],
            lineups: data[:lineups],
          })
        end

        Rails.cache.write(cache_key, current, expires_in: 4.hours)
      rescue => e
        Rails.logger.warn("[MatchDetail#broadcast] #{e.message}")
      end

      def local_match_as_fixture(match)
        home = match.home_team
        away = match.away_team

        status_map = {
          "finished"  => { "short" => "FT",  "long" => "Match Finished",  "elapsed" => 90 },
          "live"      => { "short" => "1H",  "long" => "First Half",      "elapsed" => nil },
          "scheduled" => { "short" => "NS",  "long" => "Not Started",     "elapsed" => nil },
        }
        status = status_map.fetch(match.status, { "short" => "NS", "long" => match.status&.humanize, "elapsed" => nil })

        home_wins = match.status == "finished" && match.home_score.to_i > match.away_score.to_i
        away_wins = match.status == "finished" && match.away_score.to_i > match.home_score.to_i

        comp = match.competition
        round_label = [match.group_stage.presence && "Group Stage - Group #{match.group_stage}",
                       match.round.presence].compact.first

        fixture = {
          "fixture" => {
            "id"     => match.external_id || match.id,
            "date"   => match.kickoff_at&.iso8601,
            "status" => status,
            "venue"  => { "name" => match.venue, "city" => nil },
          },
          "league" => {
            "id"      => comp&.external_id,
            "name"    => comp&.name || "World Cup 2026",
            "logo"    => comp&.logo,
            "country" => comp&.country,
            "round"   => round_label,
          },
          "teams" => {
            "home" => { "id" => home.external_id || home.id, "name" => home.name, "logo" => home.flag_url, "winner" => home_wins },
            "away" => { "id" => away.external_id || away.id, "name" => away.name, "logo" => away.flag_url, "winner" => away_wins },
          },
          "goals" => { "home" => match.home_score, "away" => match.away_score },
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
            "comments" => nil,
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
              { "type" => "Offsides",          "value" => s.offsides },
            ].reject { |stat| stat["value"].nil? },
          }
        end

        { fixture: fixture, events: events, stats: stats, lineups: [], source: "local" }
      end

      public

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
