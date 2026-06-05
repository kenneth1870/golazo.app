class WorldCupSync
  # WC 2026 league/season IDs on free-api-live-football-data.p.rapidapi.com
  # Override via ENV if the API uses different IDs.
  WC_LEAGUE_ID = (ENV["RAPIDAPI_WC_LEAGUE_ID"] || 77).to_i
  WC_SEASON_ID = (ENV["RAPIDAPI_WC_SEASON_ID"] || 2026).to_i

  STATUS_MAP = {
    1  => "scheduled",
    2  => "live", 3 => "live", 4 => "live", 5 => "live",
    6  => "finished", 7 => "finished", 8 => "finished",
    11 => "live", 12 => "live",
  }.freeze

  def initialize(competition_code: "WC")
    @api  = LiveScoresClient.new
    @code = competition_code
    @log  = Rails.logger
  end

  # Sync all live matches across all leagues, updating DB records matched by team name
  def sync_live
    matches = @api.live_matches
    return log("No live matches") if matches.empty?

    log("Live: #{matches.length} matches")
    updated = 0
    matches.each { |raw| updated += 1 if sync_match_from_live(raw) }
    log("Updated #{updated} matches")
  end

  # Sync today's matches (scheduled + live + finished today)
  def sync_today
    matches = @api.matches_for_date(Date.today)
    return log("No matches today") if matches.empty?

    log("Today: #{matches.length} matches")
    updated = 0
    matches.each { |m| updated += 1 if sync_match_from_normalized(m) }
    log("Updated #{updated} matches")
  end

  # Sync standings for the WC competition.
  # Tries the external API first; falls back to computing from DB results.
  def sync_standings(competition = nil)
    competition ||= Competition.find_by!(code: @code)

    groups = @api.league_standings(WC_LEAGUE_ID, WC_SEASON_ID)
    if groups.empty?
      log("No standings from API — recalculating from DB results")
      recalculate_standings_from_results(competition)
      return
    end

    log("Standings: #{groups.length} entries")
    groups.each { |entry| upsert_standing(entry, competition) }
  end

  # Legacy full sync — teams and fixtures come from DB seeds for WC 2026.
  # Only live/today sync and standings are updated from the API.
  def sync_all
    log("Sync all: #{@code} (standings + today)")
    competition = Competition.find_by(code: @code)
    unless competition
      log("Competition #{@code} not found in DB — run seeds first")
      return
    end
    sync_standings(competition)
    sync_today
    log("Done")
  end

  # Recalculate WC group standings purely from finished matches in the DB.
  # Called after each match result is recorded, providing an always-accurate
  # fallback independent of the external standings API.
  def recalculate_standings_from_results(competition = nil)
    competition ||= Competition.find_by!(code: @code)

    finished = Match.where(competition: competition, status: "finished")
                    .where.not(home_score: nil)
                    .includes(:home_team, :away_team)

    # Accumulate per-team stats keyed by team id
    stats = Hash.new do |h, k|
      h[k] = { team: nil, played: 0, won: 0, drawn: 0, lost: 0,
                goals_for: 0, goals_against: 0, points: 0 }
    end

    finished.each do |m|
      hs = m.home_score
      as = m.away_score
      [
        [m.home_team, hs, as],
        [m.away_team, as, hs],
      ].each do |team, gf, ga|
        s = stats[team.id]
        s[:team]           = team
        s[:played]        += 1
        s[:goals_for]     += gf
        s[:goals_against] += ga
        if gf > ga
          s[:won]    += 1
          s[:points] += 3
        elsif gf == ga
          s[:drawn]  += 1
          s[:points] += 1
        else
          s[:lost] += 1
        end
      end
    end

    # Group teams by their group letter, rank by points → GD → GF
    grouped = Team.where.not(group: nil).group_by(&:group)
    grouped.each do |group_letter, teams|
      ranked = teams.sort_by do |t|
        s = stats[t.id]
        gd = s[:goals_for] - s[:goals_against]
        [-s[:points], -gd, -s[:goals_for], t.name]
      end

      ranked.each_with_index do |team, idx|
        s = stats[team.id]
        gd = s[:goals_for] - s[:goals_against]
        Standing.find_or_initialize_by(team: team, competition: competition).tap do |st|
          st.group_name    = group_letter
          st.rank          = idx + 1
          st.played        = s[:played]
          st.won           = s[:won]
          st.drawn         = s[:drawn]
          st.lost          = s[:lost]
          st.goals_for     = s[:goals_for]
          st.goals_against = s[:goals_against]
          st.points        = s[:points]
          st.save!
        end
      end
    end

    log("Standings recalculated from #{finished.count} finished matches")
  rescue => e
    log("recalculate_standings_from_results error: #{e.message}")
  end

  private

  # Updates a DB match from a live-endpoint raw match object
  def sync_match_from_live(raw)
    home_name  = raw.dig("home", "name") || raw.dig("home", "longName")
    away_name  = raw.dig("away", "name") || raw.dig("away", "longName")
    return false unless home_name && away_name

    home_score = raw.dig("home", "score")
    away_score = raw.dig("away", "score")
    minute     = raw.dig("status", "liveTime", "long")

    match = find_match_by_teams(home_name, away_name)
    return false unless match
    return false if home_score == match.home_score && away_score == match.away_score

    match.update!(status: "live", home_score: home_score, away_score: away_score)
    broadcast_score(match, minute)
    true
  rescue => e
    log("Live sync error for #{home_name} v #{away_name}: #{e.message}")
    false
  end

  # Updates a DB match from a normalized match hash (from matches_for_date)
  def sync_match_from_normalized(m)
    home_name = m[:home]&.dig(:name) || m.dig(:home, "name")
    away_name = m[:away]&.dig(:name) || m.dig(:away, "name")
    return false unless home_name && away_name

    status     = m[:status]
    home_score = m.dig(:home, :score)
    away_score = m.dig(:away, :score)

    match = find_match_by_teams(home_name, away_name)
    return false unless match

    attrs = { status: status }
    attrs[:home_score] = home_score unless status == "scheduled"
    attrs[:away_score] = away_score unless status == "scheduled"

    match.update!(attrs)
    broadcast_score(match, m[:minute]) if status == "live"

    # Recalculate group standings after a WC match finishes
    if status == "finished" && match.competition&.code == "WC"
      RecalculateStandingsJob.perform_later
    end

    true
  rescue => e
    log("Today sync error for #{home_name} v #{away_name}: #{e.message}")
    false
  end

  def upsert_standing(entry, competition)
    # Attempt to match by team name since external_ids may differ across APIs
    team_name = entry.dig("team", "name") || entry["teamName"]
    return unless team_name

    team = Team.where(competition_id: nil)
               .where("LOWER(name) = ?", team_name.downcase)
               .first
    team ||= Team.where("LOWER(name) LIKE ?", "%#{team_name.downcase.split.first}%").first
    return unless team

    Standing.find_or_initialize_by(team: team, competition: competition).tap do |s|
      s.group_name    = entry["group"] || entry["groupName"]
      s.rank          = entry["position"] || entry["rank"]
      s.played        = entry["played"] || entry["playedGames"]
      s.won           = entry["won"]
      s.drawn         = entry["drawn"] || entry["draw"]
      s.lost          = entry["lost"]
      s.goals_for     = entry["goalsFor"] || entry["scored"]
      s.goals_against = entry["goalsAgainst"] || entry["conceded"]
      s.points        = entry["points"]
      s.save!
    end
  rescue => e
    log("Standing upsert error for #{team_name}: #{e.message}")
  end

  # FotMob / RapidAPI uses different spellings for some WC nations.
  # Map API name → DB name so sync survives naming mismatches.
  # Maps API/FotMob team name variants → DB canonical name
  TEAM_ALIASES = {
    # South Korea
    "korea republic"               => "south korea",
    "republic of korea"            => "south korea",
    # Ivory Coast
    "côte d'ivoire"                => "ivory coast",
    "cote d'ivoire"                => "ivory coast",
    "cote divoire"                 => "ivory coast",
    # United States
    "usa"                          => "united states",
    "united states of america"     => "united states",
    # Bosnia
    "bosnia and herzegovina"       => "bosnia & herz.",
    "bosnia & herzegovina"         => "bosnia & herz.",
    "bosnia-herzegovina"           => "bosnia & herz.",
    # DR Congo
    "congo dr"                     => "dr congo",
    "democratic republic of congo" => "dr congo",
    "dr. congo"                    => "dr congo",
    # Czechia
    "czech republic"               => "czechia",
    # Cape Verde
    "cabo verde"                   => "cape verde",
    # Curacao
    "curaçao"                      => "curacao",
    "curacao"                      => "curacao",
    # Turkey
    "türkiye"                      => "turkey",
    "turkiye"                      => "turkey",
    # Iran
    "ir iran"                      => "iran",
    "islamic republic of iran"     => "iran",
    # Saudi Arabia
    "ksa"                          => "saudi arabia",
    # Algeria
    "algeria"                      => "algeria",
    "algérie"                      => "algeria",
  }.freeze

  def normalize_team_name(name)
    TEAM_ALIASES[name.downcase] || name.downcase
  end

  def find_match_by_teams(home_name, away_name)
    home_normalized = normalize_team_name(home_name)
    away_normalized = normalize_team_name(away_name)

    # Exact match first
    match = Match.joins(:home_team, :away_team)
                 .where(status: %w[scheduled live])
                 .find_by(
                   "LOWER(home_teams_matches.name) = ? AND LOWER(away_teams_matches.name) = ?",
                   home_normalized, away_normalized
                 )
    return match if match

    # Alias-normalized match
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

  def broadcast_score(match, minute = nil)
    ActionCable.server.broadcast("match_#{match.id}", {
      type:       "score_update",
      home_score: match.home_score,
      away_score: match.away_score,
      status:     match.status,
      minute:     minute,
    })
  end

  def log(msg)
    @log.info("[WorldCupSync] #{msg}")
    puts msg
  end
end
