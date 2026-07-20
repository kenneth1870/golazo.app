# Warms Rails cache for club league standings (API-Football fallback path).
class ClubStandingsCache
  CODES = AppFocus::FEATURED_CLUB_CODES.freeze

  def self.warm_all!
    CODES.each { |code| warm!(code) }
  end

  def self.warm!(competition_code)
    league_id = AppFocus.league_id_for(competition_code)
    return unless league_id

    client = LiveScoresClient.new
    rows   = client.league_standings_for_code(competition_code)
    return if rows.blank?

    flat = rows.map do |r|
      team = r["team"] || {}
      display_name = TeamDisplayNames.display_name(team["name"])
      {
        rank:          r["rank"],
        group_name:    (r["group"] || "Overall").to_s.sub(/\AGroup\s+/i, ""),
        team:          {
          name:     display_name,
          code:     display_name&.slice(0, 3)&.upcase,
          flag_url: TeamDisplayNames.flag_url(team["name"], team["logo"])
        },
        played:        r["all"]["played"],
        won:           r["all"]["win"],
        drawn:         r["all"]["draw"],
        lost:          r["all"]["lose"],
        goals_for:     r["all"]["goals"]["for"],
        goals_against: r["all"]["goals"]["against"],
        goal_diff:     r["goalsDiff"],
        points:        r["points"]
      }
    end

    Rails.cache.write(
      "standings_#{competition_code}",
      flat.group_by { |s| s[:group_name] },
      expires_in: 30.minutes
    )
  rescue => e
    Rails.logger.error("[ClubStandingsCache] #{competition_code}: #{e.message}")
  end
end
