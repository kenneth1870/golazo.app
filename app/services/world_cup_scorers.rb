class WorldCupScorers
  CACHE_TTL = 10.minutes
  FIXTURE_EVENTS_TTL = 24.hours

  def self.scorers(competition_code = "WC")
    Rails.cache.fetch("wc_scorers_v1_#{competition_code}", expires_in: CACHE_TTL) do
      aggregate(competition_code, stat: :goals)
    end.presence || []
  end

  def self.assists(competition_code = "WC")
    Rails.cache.fetch("wc_assists_v1_#{competition_code}", expires_in: CACHE_TTL) do
      aggregate(competition_code, stat: :assists)
    end.presence || []
  end

  def self.cards(competition_code = "WC", type: :yellow)
    key = "wc_#{type}_cards_v1_#{competition_code}"
    Rails.cache.fetch(key, expires_in: CACHE_TTL) do
      aggregate(competition_code, stat: type == :red ? :red_cards : :yellow_cards)
    end.presence || []
  end

  private

  def self.aggregate(competition_code, stat:)
    competition = Competition.find_by(code: competition_code)
    return [] unless competition

    finished = Match
      .where(competition: competition, status: "finished")
      .where.not(external_id: nil)
      .pluck(:external_id)

    return [] if finished.empty?

    tally = Hash.new { |h, k| h[k] = { goals: 0, assists: 0, yellow_cards: 0, red_cards: 0, team_name: nil, team_logo: nil } }

    finished.each do |fixture_id|
      events = fetch_events(fixture_id)
      events.each do |e|
        next unless e["type"].in?(["Goal", "Card"])

        if e["type"] == "Goal" && e["detail"] != "Missed Penalty"
          scorer = e.dig("player", "name").presence
          if scorer
            tally[scorer][:team_name] ||= e.dig("team", "name")
            tally[scorer][:team_logo] ||= e.dig("team", "logo")
            tally[scorer][:goals] += 1
          end

          assister = e.dig("assist", "name").presence
          if assister
            tally[assister][:team_name] ||= e.dig("team", "name")
            tally[assister][:team_logo] ||= e.dig("team", "logo")
            tally[assister][:assists] += 1
          end
        elsif e["type"] == "Card"
          player = e.dig("player", "name").presence
          next if player.blank?
          tally[player][:team_name] ||= e.dig("team", "name")
          tally[player][:team_logo] ||= e.dig("team", "logo")
          case e["detail"]
          when "Yellow Card" then tally[player][:yellow_cards] += 1
          when "Red Card"    then tally[player][:red_cards] += 1
          end
        end
      end
    end

    sorted = tally.map do |name, stats|
      {
        player: { name: name, photo: nil, nationality: nil },
        team:   { name: stats[:team_name], crest: stats[:team_logo] },
        goals:        stats[:goals],
        assists:      stats[:assists],
        yellow_cards: stats[:yellow_cards],
        red_cards:    stats[:red_cards],
        value: stats[stat]
      }
    end.select { |r| r[:value].to_i > 0 }

    sorted.sort_by { |r| -r[:value].to_i }
  end

  def self.fetch_events(fixture_id)
    Rails.cache.fetch("wc_fixture_events_v1_#{fixture_id}", expires_in: FIXTURE_EVENTS_TTL) do
      key = ENV["APISPORTS_KEY"].presence
      return [] if key.blank?

      conn = Faraday.new(url: "https://v3.football.api-sports.io") do |f|
        f.headers["x-apisports-key"] = key
        f.options.timeout      = 10
        f.options.open_timeout = 6
      end

      resp = conn.get("fixtures/events", fixture: fixture_id)
      return [] unless resp.success?

      data = JSON.parse(resp.body)
      data.dig("response") || []
    rescue => e
      Rails.logger.error("[WorldCupScorers] events for #{fixture_id}: #{e.message}")
      []
    end
  end
end
