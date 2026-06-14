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
# R32 positions 1–16 correspond to official FIFA match numbers 73–88 respectively.
#
# Third-place team slots (T1–T8) are assigned in best-to-worst ranking order as a
# practical approximation. The exact slot assignment depends on which groups the 8
# advancing third-placed teams come from (FIFA uses a 495-combination lookup table).
# The ranked fallback may display a slightly different opponent for 3rd-place slots
# until the combination is resolved at end of group stage.
class WorldCupKnockout
  ROUND_DATES = {
    "Round of 32"   => Date.new(2026, 6, 28),
    "Round of 16"   => Date.new(2026, 7,  4),
    "Quarter Final" => Date.new(2026, 7,  9),
    "Semi Final"    => Date.new(2026, 7, 14),
    "3rd Place"     => Date.new(2026, 7, 18),
    "Final"         => Date.new(2026, 7, 19)
  }.freeze

  # Official FIFA 2026 Round of 32 pairings (FIFA matches 73–88 in tournament order).
  # Source: FIFA official bracket + Wikipedia 2026 FIFA World Cup knockout stage.
  #
  # 8 certain matchups (group winner vs runner-up, or runner-up vs runner-up):
  #   2A-2B, 1F-2C, 1C-2F, 2E-2I, 1H-2J, 1J-2H, 2K-2L, 2D-2G
  #
  # 8 slots where the opponent is the best available 3rd-placed team (T1=best…T8):
  #   1E-T1, 1I-T2, 1A-T3, 1L-T4, 1D-T5, 1G-T6, 1B-T7, 1K-T8
  R32_SLOTS = [
    %w[2A 2B],  # M73: Runner-up A vs Runner-up B
    %w[1E T1],  # M74: Winner E vs best 3rd (from A/B/C/D/F)
    %w[1F 2C],  # M75: Winner F vs Runner-up C
    %w[1C 2F],  # M76: Winner C vs Runner-up F
    %w[1I T2],  # M77: Winner I vs best 3rd (from C/D/F/G/H)
    %w[2E 2I],  # M78: Runner-up E vs Runner-up I
    %w[1A T3],  # M79: Winner A vs best 3rd (from C/E/F/H/I)
    %w[1L T4],  # M80: Winner L vs best 3rd (from E/H/I/J/K)
    %w[1D T5],  # M81: Winner D vs best 3rd (from B/E/F/I/J)
    %w[1G T6],  # M82: Winner G vs best 3rd (from A/E/H/I/J)
    %w[2K 2L],  # M83: Runner-up K vs Runner-up L
    %w[1H 2J],  # M84: Winner H vs Runner-up J
    %w[1B T7],  # M85: Winner B vs best 3rd (from E/F/G/I/J)
    %w[1J 2H],  # M86: Winner J vs Runner-up H
    %w[1K T8],  # M87: Winner K vs best 3rd (from D/E/I/J/L)
    %w[2D 2G]  # M88: Runner-up D vs Runner-up G
  ].freeze

  # Official R16 cross-bracket pairings (FIFA matches 89–96).
  # Each pair is [R32_pos_home, R32_pos_away] using positions 1–16 above.
  R16_PAIRINGS = [
    [ 2,  5 ],   # M89 (pos 17): W74 vs W77
    [ 1,  3 ],   # M90 (pos 18): W73 vs W75
    [ 4,  6 ],   # M91 (pos 19): W76 vs W78
    [ 7,  8 ],   # M92 (pos 20): W79 vs W80
    [ 11, 12 ],  # M93 (pos 21): W83 vs W84
    [ 9,  10 ],  # M94 (pos 22): W81 vs W82
    [ 14, 16 ],  # M95 (pos 23): W86 vs W88
    [ 13, 15 ]  # M96 (pos 24): W85 vs W87
  ].freeze

  # Official QF cross-bracket pairings (FIFA matches 97–100).
  # Each pair is [R16_pos_home, R16_pos_away] using positions 17–24 above.
  QF_PAIRINGS = [
    [ 17, 18 ],  # M97 (pos 25): W89 vs W90
    [ 21, 22 ],  # M98 (pos 26): W93 vs W94
    [ 19, 20 ],  # M99 (pos 27): W91 vs W92
    [ 23, 24 ]  # M100 (pos 28): W95 vs W96
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

  # Creates or corrects the 32 knockout fixtures.
  # Slot labels on unfinished matches are always updated so bracket corrections propagate.
  def ensure_fixtures!
    return unless @competition

    bracket_definition.each do |defn|
      match = @competition.matches.find_or_initialize_by(bracket_pos: defn[:pos])
      match.round      = defn[:round]
      match.group_stage = nil
      match.status    ||= "scheduled"
      match.kickoff_at ||= defn[:date].in_time_zone("UTC")
      unless match.status == "finished"
        match.home_slot = defn[:home_slot]
        match.away_slot = defn[:away_slot]
      end
      match.save!
    end
  end

  private

  def bracket_definition
    defs = []

    R32_SLOTS.each_with_index do |(home, away), i|
      defs << { pos: i + 1, round: "Round of 32", home_slot: home, away_slot: away,
                date: ROUND_DATES["Round of 32"] }
    end

    R16_PAIRINGS.each_with_index do |(a, b), i|
      defs << { pos: 17 + i, round: "Round of 16",
                home_slot: "W#{a}", away_slot: "W#{b}",
                date: ROUND_DATES["Round of 16"] }
    end

    QF_PAIRINGS.each_with_index do |(a, b), i|
      defs << { pos: 25 + i, round: "Quarter Final",
                home_slot: "W#{a}", away_slot: "W#{b}",
                date: ROUND_DATES["Quarter Final"] }
    end

    defs << { pos: 29, round: "Semi Final", home_slot: "W25", away_slot: "W26",
              date: ROUND_DATES["Semi Final"] }
    defs << { pos: 30, round: "Semi Final", home_slot: "W27", away_slot: "W28",
              date: ROUND_DATES["Semi Final"] }
    defs << { pos: 31, round: "3rd Place",  home_slot: "L29", away_slot: "L30",
              date: ROUND_DATES["3rd Place"] }
    defs << { pos: 32, round: "Final",      home_slot: "W29", away_slot: "W30",
              date: ROUND_DATES["Final"] }

    defs
  end

  def resolve_round_of_32(standings)
    qualifiers = standings.qualifiers
    thirds     = standings.best_thirds(8)
    all_done   = all_groups_complete?

    @competition.matches.where(round: "Round of 32").find_each do |m|
      next if m.status == "finished"

      home = team_for_group_slot(m.home_slot, qualifiers, thirds, all_done)
      away = team_for_group_slot(m.away_slot, qualifiers, thirds, all_done)

      m.update!(home_team: home, away_team: away) if home != m.home_team || away != m.away_team
    end
  end

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

  def all_groups_complete?
    groups = Team.where.not(group: nil).distinct.pluck(:group)
    groups.any? && groups.all? { |g| group_complete?(g) }
  end

  def propagate_later_rounds
    @competition.matches.knockout.where.not(round: "Round of 32")
                .order(:bracket_pos).each do |m|
      next if m.status == "finished"

      home = team_for_feeder_slot(m.home_slot)
      away = team_for_feeder_slot(m.away_slot)
      m.update!(home_team: home, away_team: away) if home != m.home_team || away != m.away_team
    end
  end

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

  def team_for_feeder_slot(slot)
    return nil if slot.blank?

    kind = slot[0]
    pos  = slot[1..].to_i
    feeder = @competition.matches.find_by(bracket_pos: pos)
    return nil unless feeder&.status == "finished" && feeder.home_score && feeder.away_score
    return nil if feeder.home_score == feeder.away_score

    home_won = feeder.home_score > feeder.away_score
    case kind
    when "W" then home_won ? feeder.home_team : feeder.away_team
    when "L" then home_won ? feeder.away_team : feeder.home_team
    end
  end
end
