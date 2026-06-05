# Helpers for building World Cup test data inline (fixtures are intentionally
# empty so each test controls exactly what exists).
module WcBuilders
  def wc_competition
    Competition.find_or_create_by!(code: "WC") { |c| c.name = "World Cup" }
  end

  def team(code, group: nil, name: nil)
    Team.create!(code: code, name: name || "Team #{code}", group: group)
  end

  def finished(home, away, home_score, away_score, competition:, group: nil, round: nil, kickoff: Time.current)
    Match.create!(
      home_team: home, away_team: away, competition: competition,
      home_score: home_score, away_score: away_score, status: "finished",
      group_stage: group, round: round, kickoff_at: kickoff
    )
  end

  # Full round-robin for a 4-team group from a results matrix.
  def round_robin(teams, results, competition:, group:)
    results.each do |(i, j, hs, as)|
      finished(teams[i], teams[j], hs, as, competition: competition, group: group)
    end
  end
end
