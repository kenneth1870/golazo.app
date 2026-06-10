# Builds and maintains the World Cup knockout bracket.
#
#   * ensure_fixtures!  creates the 32 knockout Match rows (idempotent) with their
#                       round, bracket position, slot labels and round dates. Teams
#                       are left NULL (TBD) until they can be resolved.
#   * rebuild!          fills R32 from the computed group standings (group winners,
#                       runners-up, and the 8 best third-placed teams) and then
#                       propagates winners up through R16 → QF → SF → Final, plus
#                       the third-place play-off from the semi-final losers.
#
# Bracket positions are global so later rounds can reference their feeders:
#   R32: 1..16   R16: 17..24   QF: 25..28   SF: 29..30   3rd: 31   Final: 32
#
# NOTE: the R32 group-slot pairings below reflect the standard 48-team bracket
# *shape*; the precise official 2026 slotting (especially which group's third-
# placed team lands in which slot) should be reconciled against FIFA's published
# bracket. Third-placed teams are assigned to their slots in ranked order — a
# documented simplification, since FIFA uses a fixed combination lookup table.
class WorldCupKnockout
  ROUND_DATES = {
    "Round of 32"   => Date.new(2026, 6, 28),
    "Round of 16"   => Date.new(2026, 7,  4),
    "Quarter Final" => Date.new(2026, 7,  9),
    "Semi Final"    => Date.new(2026, 7, 14),
    "3rd Place"     => Date.new(2026, 7, 18),
    "Final"         => Date.new(2026, 7, 19)
  }.freeze

  # 16 R32 matches: [home_slot, away_slot]. Slots: "1X"/"2X" = winner/runner-up
  # of group X; "T1".."T8" = best third-placed teams (ranked).
  #
  # TODO (URGENT — tournament is now underway as of 2026-06-09):
  # Verify these pairings against the official FIFA 2026 bracket once the group
  # stage is complete and the actual R32 draw pairings are published.
  # Third-placed team slots (T1-T8) are especially likely to differ from the
  # placeholder ranking-order assignment used here — FIFA uses a fixed lookup
  # table that maps the specific groups' third-placed teams to predetermined slots.
  # See: https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/
  R32_SLOTS = [
    %w[1A T1], %w[1C 2F], %w[1E 2D], %w[1G T2],
    %w[1I 2L], %w[1K T3], %w[1B 2I], %w[1D T4],
    %w[1F 2C], %w[1H 2J], %w[1J T5], %w[1L 2E],
    %w[2A 2B], %w[T6 2H], %w[T7 2G], %w[T8 2K]
  ].freeze

  def self.rebuild!
    new.rebuild!
  end

  def initialize(competition: Competition.find_by(code: "WC"))
    @competition = competition
  end

  def rebuild!
    return unless @competition

    ensure_fixtures!
    standings = WorldCupStandings.new(@competition)
    resolve_round_of_32(standings)
    propagate_later_rounds
  end

  # Creates the 32 knockout fixtures if they don't already exist.
  def ensure_fixtures!
    return unless @competition

    bracket_definition.each do |defn|
      match = @competition.matches.find_or_initialize_by(bracket_pos: defn[:pos])
      match.round       = defn[:round]
      match.home_slot ||= defn[:home_slot]
      match.away_slot ||= defn[:away_slot]
      match.group_stage = nil
      match.status    ||= "scheduled"
      match.kickoff_at ||= defn[:date].in_time_zone("UTC")
      match.save!
    end
  end

  private

  # Full 32-match bracket definition with feeder-derived slot labels.
  def bracket_definition
    defs = []

    R32_SLOTS.each_with_index do |(home, away), i|
      defs << { pos: i + 1, round: "Round of 32", home_slot: home, away_slot: away,
                date: ROUND_DATES["Round of 32"] }
    end

    # R16 17..24 fed by R32 winners
    8.times do |i|
      defs << { pos: 17 + i, round: "Round of 16",
                home_slot: "W#{2 * i + 1}", away_slot: "W#{2 * i + 2}",
                date: ROUND_DATES["Round of 16"] }
    end

    # QF 25..28 fed by R16 winners
    4.times do |i|
      defs << { pos: 25 + i, round: "Quarter Final",
                home_slot: "W#{17 + 2 * i}", away_slot: "W#{17 + 2 * i + 1}",
                date: ROUND_DATES["Quarter Final"] }
    end

    # SF 29..30 fed by QF winners
    2.times do |i|
      defs << { pos: 29 + i, round: "Semi Final",
                home_slot: "W#{25 + 2 * i}", away_slot: "W#{25 + 2 * i + 1}",
                date: ROUND_DATES["Semi Final"] }
    end

    # 3rd place 31 fed by SF losers; Final 32 fed by SF winners
    defs << { pos: 31, round: "3rd Place", home_slot: "L29", away_slot: "L30",
              date: ROUND_DATES["3rd Place"] }
    defs << { pos: 32, round: "Final", home_slot: "W29", away_slot: "W30",
              date: ROUND_DATES["Final"] }

    defs
  end

  def resolve_round_of_32(standings)
    qualifiers = standings.qualifiers
    thirds     = standings.best_thirds(8)
    all_done   = all_groups_complete?

    @competition.matches.where(round: "Round of 32").find_each do |m|
      next if m.status == "finished" # don't disturb a played match

      home = team_for_group_slot(m.home_slot, qualifiers, thirds, all_done)
      away = team_for_group_slot(m.away_slot, qualifiers, thirds, all_done)

      m.update!(home_team: home, away_team: away) if home != m.home_team || away != m.away_team
    end
  end

  # A group's winner/runner-up is only final once every team in it has played all
  # its group games (each team plays the other N-1). Counting played games rather
  # than "no unfinished rows" stays correct even if not every fixture exists yet.
  def group_complete?(letter)
    team_ids = Team.where(group: letter).pluck(:id)
    return false if team_ids.size < 2

    needed = team_ids.size - 1
    counts = Hash.new(0)
    @competition.matches.where(status: "finished", group_stage: letter)
                .pluck(:home_team_id, :away_team_id).each do |home_id, away_id|
      counts[home_id] += 1
      counts[away_id] += 1
    end

    team_ids.all? { |id| counts[id] >= needed }
  end

  # The best-third-placed ranking is only final once every group is complete.
  def all_groups_complete?
    groups = Team.where.not(group: nil).distinct.pluck(:group)
    groups.any? && groups.all? { |g| group_complete?(g) }
  end

  def propagate_later_rounds
    # Process in bracket order so a round's winners are available to the next.
    @competition.matches.knockout.where.not(round: "Round of 32")
                .order(:bracket_pos).find_each do |m|
      next if m.status == "finished"

      home = team_for_feeder_slot(m.home_slot)
      away = team_for_feeder_slot(m.away_slot)
      m.update!(home_team: home, away_team: away) if home != m.home_team || away != m.away_team
    end
  end

  # "1A"/"2B" → qualifier; "T3" → 3rd-placed rank 3. Returns nil (stay TBD)
  # until the feeding group(s) are actually complete.
  def team_for_group_slot(slot, qualifiers, thirds, all_done)
    return nil if slot.blank?

    if slot.start_with?("T")
      return nil unless all_done
      thirds[slot[1..].to_i - 1]&.team
    else
      letter = slot[1]
      return nil unless group_complete?(letter)
      qualifiers[slot]
    end
  end

  # "W29" → winner of bracket match 29; "L30" → loser of bracket match 30
  def team_for_feeder_slot(slot)
    return nil if slot.blank?

    kind = slot[0]
    pos  = slot[1..].to_i
    feeder = @competition.matches.find_by(bracket_pos: pos)
    return nil unless feeder&.status == "finished" && feeder.home_score && feeder.away_score
    return nil if feeder.home_score == feeder.away_score # undecided (would need ET/pens)

    home_won = feeder.home_score > feeder.away_score
    case kind
    when "W" then home_won ? feeder.home_team : feeder.away_team
    when "L" then home_won ? feeder.away_team : feeder.home_team
    end
  end
end
