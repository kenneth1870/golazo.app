class WorldCupScorers
  CACHE_TTL = 10.minutes
  FIXTURE_EVENTS_TTL = 24.hours

  def self.scorers(competition_code = "WC")
    Rails.cache.fetch("wc_scorers_v1_#{competition_code}", expires_in: CACHE_TTL, race_condition_ttl: 10.seconds) do
      aggregate(competition_code, stat: :goals)
    end.presence || []
  end

  def self.assists(competition_code = "WC")
    Rails.cache.fetch("wc_assists_v1_#{competition_code}", expires_in: CACHE_TTL, race_condition_ttl: 10.seconds) do
      aggregate(competition_code, stat: :assists)
    end.presence || []
  end

  def self.cards(competition_code = "WC", type: :yellow)
    key = "wc_#{type}_cards_v1_#{competition_code}"
    Rails.cache.fetch(key, expires_in: CACHE_TTL, race_condition_ttl: 10.seconds) do
      aggregate(competition_code, stat: type == :red ? :red_cards : :yellow_cards)
    end.presence || []
  end

  private

  def self.aggregate(competition_code, stat:)
    competition = Competition.find_by(code: competition_code)
    return [] unless competition

    finished_matches = Match
      .includes(:home_team, :away_team)
      .where(competition: competition, status: "finished")
      .where.not(external_id: nil)

    return [] if finished_matches.empty?

    # Count how many finished matches each team has played so we can show it
    # on the scorers page instead of the always-wrong "0 played".
    team_played = Hash.new(0)
    finished_matches.each do |m|
      team_played[m.home_team&.name] += 1 if m.home_team&.name
      team_played[m.away_team&.name] += 1 if m.away_team&.name
    end

    finished = finished_matches.pluck(:external_id)

    # Key: player_id when available, else player_name (downcased for dedup).
    # The API returns inconsistent name formats across matches (e.g. "K. Mbappe"
    # in one fixture vs "Kylian Mbappé" in another), so we must use the numeric
    # player ID as the canonical key. We keep the longest name seen so the full
    # name wins over the abbreviated one.
    tally = Hash.new { |h, k| h[k] = { name: nil, goals: 0, assists: 0, yellow_cards: 0, red_cards: 0, team_name: nil, team_logo: nil } }

    tally_key = ->(player_id, player_name) {
      player_id.present? ? "id_#{player_id}" : player_name.to_s.downcase
    }

    update_name = ->(bucket, name) {
      bucket[:name] = name if name.to_s.length > bucket[:name].to_s.length
    }

    finished.each do |fixture_id|
      events = fetch_events(fixture_id)
      events.each do |e|
        next unless e["type"].in?([ "Goal", "Card" ])

        if e["type"] == "Goal" && !%w[Missed\ Penalty Own\ Goal].include?(e["detail"])
          scorer_name = e.dig("player", "name").presence
          scorer_id   = e.dig("player", "id")
          if scorer_name
            key = tally_key.call(scorer_id, scorer_name)
            tally[key][:team_name] ||= e.dig("team", "name")
            tally[key][:team_logo] ||= e.dig("team", "logo")
            tally[key][:goals] += 1
            update_name.call(tally[key], scorer_name)
          end

          assist_name = e.dig("assist", "name").presence
          assist_id   = e.dig("assist", "id")
          if assist_name
            key = tally_key.call(assist_id, assist_name)
            tally[key][:team_name] ||= e.dig("team", "name")
            tally[key][:team_logo] ||= e.dig("team", "logo")
            tally[key][:assists] += 1
            update_name.call(tally[key], assist_name)
          end
        elsif e["type"] == "Card"
          player_name = e.dig("player", "name").presence
          player_id   = e.dig("player", "id")
          next if player_name.blank?
          key = tally_key.call(player_id, player_name)
          tally[key][:team_name] ||= e.dig("team", "name")
          tally[key][:team_logo] ||= e.dig("team", "logo")
          update_name.call(tally[key], player_name)
          case e["detail"]
          when "Yellow Card" then tally[key][:yellow_cards] += 1
          when "Red Card"    then tally[key][:red_cards] += 1
          end
        end
      end
    end

    sorted = tally.map do |_key, stats|
      {
        player: { name: stats[:name], photo: nil, nationality: nil },
        team:   { name: stats[:team_name], crest: stats[:team_logo] },
        goals:        stats[:goals],
        assists:      stats[:assists],
        yellow_cards: stats[:yellow_cards],
        red_cards:    stats[:red_cards],
        played:       team_played[stats[:team_name]].presence,
        value: stats[stat]
      }
    end.select { |r| r[:value].to_i > 0 }

    sorted.sort_by { |r| -r[:value].to_i }
  end

  def self.client
    @client ||= LiveScoresClient.new
  end

  def self.fetch_events(fixture_id)
    cached = Rails.cache.read("wc_fixture_events_v1_#{fixture_id}")
    return cached unless cached.nil?

    detail = client.match_detail(fixture_id)
    # Don't cache on API failure — let the next request retry rather than
    # locking empty events in for 24 h and zeroing out a player's goal tally.
    return [] unless detail

    events = detail[:events]&.map do |e|
      {
        "type"      => e[:type],
        "detail"    => e[:detail],
        "team"      => { "name" => e.dig(:team, :name), "logo" => e.dig(:team, :logo) },
        "player"    => { "name" => e[:player], "id" => e[:player_id] },
        "assist"    => { "name" => e[:assist],  "id" => e[:assist_id] }
      }
    end || []

    Rails.cache.write("wc_fixture_events_v1_#{fixture_id}", events, expires_in: FIXTURE_EVENTS_TTL)
    events
  rescue => e
    Rails.logger.error("[WorldCupScorers] events for #{fixture_id}: #{e.message}")
    []
  end
end
