# Syncs live scores from RapidAPI (all leagues) into our Match table
# and broadcasts updates via ActionCable
class LiveScoresSync
  def initialize
    @api = LiveScoresClient.new
    @log = Rails.logger
  end

  def sync
    live = @api.live_matches
    return log("No live matches") if live.empty?

    log("#{live.length} live matches across #{live.map { |m| m['leagueId'] }.uniq.length} leagues")

    updated = 0
    live.each do |raw|
      match = find_match(raw)
      next unless match

      home_score = raw.dig("home", "score")
      away_score = raw.dig("away", "score")
      minute     = raw.dig("status", "liveTime", "long")

      next unless home_score != match.home_score || away_score != match.away_score

      match.update!(
        status:     "live",
        home_score: home_score,
        away_score: away_score
      )

      ActionCable.server.broadcast("match_#{match.id}", {
        type:       "score_update",
        home_score: home_score,
        away_score: away_score,
        status:     "live",
        minute:     minute
      })

      updated += 1
    end

    log("Updated #{updated} matches")
  end

  private

  def find_match(raw)
    # Try to match by home/away team names against our DB
    home_name = raw.dig("home", "name") || raw.dig("home", "longName")
    away_name = raw.dig("away", "name") || raw.dig("away", "longName")
    return nil unless home_name && away_name

    Match.joins(:home_team, :away_team)
         .where(status: %w[scheduled live])
         .find_by(
           "LOWER(home_teams_matches.name) = ? AND LOWER(away_teams_matches.name) = ?",
           home_name.downcase, away_name.downcase
         )
  rescue => e
    log("Match lookup error: #{e.message}")
    nil
  end

  def log(msg)
    @log.info("[LiveScoresSync] #{msg}")
  end
end
