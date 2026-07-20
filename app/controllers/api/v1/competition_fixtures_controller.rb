module Api
  module V1
    class CompetitionFixturesController < BaseController
      include ApiMatchNormalizer

      def index
        code = params[:code].to_s.upcase
        league_id = AppFocus.league_id_for(code)
        return render(json: []) unless league_id

        tz    = sanitize_tz(params[:tz])
        today = params[:date].present? ? Date.parse(params[:date]) : TZInfo::Timezone.get(tz).now.to_date
        client = LiveScoresClient.new

        days = if params[:tab].to_s == "results"
          (0..6).map { |i| today - i }
        elsif params[:tab].to_s == "fixtures"
          (0..13).map { |i| today + i }
        else
          [ today - 1, today, today + 1 ]
        end

        raw = days.flat_map { |d| client.matches_for_date(d, timezone: tz) }
        raw = filter_matches_for_competition(raw, code)
        seen = {}
        matches = raw.filter_map do |m|
          key = m[:external_id].to_s
          next if key.blank? || seen[key]
          seen[key] = true
          normalize_api_match(m)
        end

        if params[:tab].to_s == "results"
          matches.select! { |m| m[:status] == "finished" }
          matches.sort_by! { |m| m[:kickoff_at].to_s }.reverse!
        elsif params[:tab].to_s == "fixtures"
          matches.select! { |m| m[:status] == "scheduled" }
          matches.sort_by! { |m| m[:kickoff_at].to_s }
        else
          matches.sort_by! { |m| m[:kickoff_at].to_s }
        end

        render json: matches
      rescue ArgumentError
        render json: []
      end
    end
  end
end
