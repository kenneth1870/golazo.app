# Computes World Cup group standings from finished group-stage matches, applying
# FIFA tiebreakers, and exposes the data the rest of the app needs:
#
#   * groups            => { "A" => [TeamStat ranked], ... }
#   * qualifiers        => { "1A" => Team, "2A" => Team, ... }  (winner/runner-up)
#   * third_place_table => [TeamStat] ranked across all groups' 3rd-placed teams
#   * best_thirds(n)    => first n of third_place_table (the n that advance)
#
# FIFA tiebreakers applied, in order:
#   1. Points  2. Goal difference  3. Goals for          (all overall)
#   then, among teams still level, head-to-head:
#   4. Points  5. Goal difference  6. Goals for          (in matches between them)
#   7. fair-play / drawing of lots → we don't track disciplinary points, so we
#      fall back to a deterministic alphabetical order (documented compromise).
class WorldCupStandings
  TeamStat = Struct.new(
    :team, :played, :won, :drawn, :lost, :goals_for, :goals_against, :points,
    keyword_init: true
  ) do
    def goal_difference = goals_for - goals_against
  end

  def initialize(competition)
    @competition = competition
  end

  def groups
    @groups ||= compute_groups
  end

  # "1A" => Group A winner, "2A" => Group A runner-up, ...
  def qualifiers
    @qualifiers ||= groups.each_with_object({}) do |(letter, ranked), acc|
      acc["1#{letter}"] = ranked[0]&.team
      acc["2#{letter}"] = ranked[1]&.team
    end
  end

  # All groups' third-placed teams, ranked best-to-worst (overall criteria).
  def third_place_table
    @third_place_table ||= groups.values
                                 .filter_map { |ranked| ranked[2] }
                                 .sort_by { |s| [ -s.points, -s.goal_difference, -s.goals_for, s.team.name ] }
  end

  def best_thirds(count = 8)
    third_place_table.first(count)
  end

  private

  def finished_group_matches
    @finished_group_matches ||=
      @competition.matches
                  .where(status: "finished")
                  .where.not(home_score: nil, away_score: nil)
                  .where.not(group_stage: nil)
                  .includes(:home_team, :away_team)
                  .select { |m| m.home_team && m.away_team }
  end

  def compute_groups
    stats = accumulate(finished_group_matches)

    Team.where.not(group: nil).group_by(&:group).sort.to_h.transform_values do |teams|
      rank_group(teams, stats)
    end
  end

  def accumulate(matches)
    stats = Hash.new do |h, id|
      h[id] = TeamStat.new(team: nil, played: 0, won: 0, drawn: 0, lost: 0,
                           goals_for: 0, goals_against: 0, points: 0)
    end

    matches.each do |m|
      apply(stats, m.home_team, m.home_score, m.away_score)
      apply(stats, m.away_team, m.away_score, m.home_score)
    end
    stats
  end

  def apply(stats, team, gf, ga)
    s = stats[team.id]
    s.team = team
    s.played += 1
    s.goals_for += gf
    s.goals_against += ga
    if gf > ga
      s.won += 1
      s.points += 3
    elsif gf == ga
      s.drawn += 1
      s.points += 1
    else
      s.lost += 1
    end
  end

  # Returns the group's TeamStats ranked. Teams with no played matches still
  # appear (zeroed), so every group always has its full set of teams.
  def rank_group(teams, stats)
    rows = teams.map { |t| stats[t.id].tap { |s| s.team ||= t } }

    primary = rows.sort_by { |s| [ -s.points, -s.goal_difference, -s.goals_for ] }

    # Break ties (equal points/GD/GF) with a head-to-head mini-table.
    primary
      .chunk_while { |a, b| level?(a, b) }
      .flat_map { |chunk| chunk.size > 1 ? break_head_to_head(chunk) : chunk }
  end

  def level?(a, b)
    a.points == b.points &&
      a.goal_difference == b.goal_difference &&
      a.goals_for == b.goals_for
  end

  def break_head_to_head(tied)
    ids = tied.map { |s| s.team.id }
    mini = Hash.new { |h, k| h[k] = { points: 0, gd: 0, gf: 0 } }

    finished_group_matches.each do |m|
      next unless ids.include?(m.home_team_id) && ids.include?(m.away_team_id)
      apply_h2h(mini, m.home_team_id, m.home_score, m.away_score)
      apply_h2h(mini, m.away_team_id, m.away_score, m.home_score)
    end

    tied.sort_by do |s|
      h = mini[s.team.id]
      [ -h[:points], -h[:gd], -h[:gf], s.team.name ]
    end
  end

  def apply_h2h(mini, team_id, gf, ga)
    h = mini[team_id]
    h[:gd] += (gf - ga)
    h[:gf] += gf
    h[:points] += (gf > ga ? 3 : gf == ga ? 1 : 0)
  end
end
