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
# Third-place team slots use FIFA Annex C (495-combination lookup) once all groups
# are complete. Until then T-slots stay TBD.
class WorldCupKnockout
  ROUND_DATES = {
    "Round of 32"   => Date.new(2026, 7,  1),
    "Round of 16"   => Date.new(2026, 7,  5),
    "Quarter Final" => Date.new(2026, 7, 10),
    "Semi Final"    => Date.new(2026, 7, 14),
    "3rd Place"     => Date.new(2026, 7, 18),
    "Final"         => Date.new(2026, 7, 19)
  }.freeze

  # Third-place T-slots in R32_SLOTS map to the group winner they oppose (Annex C columns).
  T_SLOT_WINNERS = {
    "T1" => "E", "T2" => "I", "T3" => "A", "T4" => "L",
    "T5" => "D", "T6" => "G", "T7" => "B", "T8" => "K"
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

  # Pick the empty bracket slot whose expected teams match this fixture pair.
  def match_empty_slot(empties, home_team, away_team)
    return nil if empties.blank?

    standings  = WorldCupStandings.new(@competition)
    all_done   = all_groups_complete?
    qualifiers = standings.qualifiers

    empties.find do |slot|
      eh = team_for_group_slot(slot.home_slot, qualifiers, standings, all_done)
      ea = team_for_group_slot(slot.away_slot, qualifiers, standings, all_done)
      next false unless eh && ea

      (eh.id == home_team.id && ea.id == away_team.id) ||
        (eh.id == away_team.id && ea.id == home_team.id)
    end
  end

  # Among empty slots, return the one whose placeholder kickoff is closest.
  def closest_empty_slot_by_kickoff(empties, kickoff)
    return nil if empties.blank? || kickoff.blank?

    ko = Time.parse(kickoff.to_s).utc
    closest = empties.min_by { |s| s.kickoff_at ? (s.kickoff_at.utc - ko).abs : Float::INFINITY }
    return nil unless closest&.kickoff_at
    return closest if (closest.kickoff_at.utc - ko).abs <= 18.hours

    nil
  rescue ArgumentError, TypeError
    nil
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
      # Set or correct kickoff_at for unfinished matches that haven't been matched
      # to an API fixture yet (external_id nil = still a placeholder). Once an
      # external_id is set by resolve_knockout_from_api, leave the real kickoff alone.
      if match.status != "finished" && match.external_id.nil?
        match.kickoff_at = defn[:date].in_time_zone("UTC")
      end
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
    all_done   = all_groups_complete?

    # Teams already locked into API-confirmed R32 slots must not appear in a
    # second slot. Our R32_SLOTS ordering doesn't perfectly match the actual
    # 2026 WC bracket, so the computed seeding for unfilled slots can produce
    # teams that the API has already placed elsewhere.
    confirmed_team_ids = @competition.matches
                                     .where(round: "Round of 32")
                                     .where.not(external_id: nil)
                                     .pluck(:home_team_id, :away_team_id)
                                     .flatten.compact.to_set

    @competition.matches.where(round: "Round of 32").find_each do |m|
      next if m.status == "finished"
      next if m.external_id.present?

      home = team_for_group_slot(m.home_slot, qualifiers, standings, all_done)
      away = team_for_group_slot(m.away_slot, qualifiers, standings, all_done)

      # Suppress any team the API has already confirmed in another R32 slot
      home = nil if home && confirmed_team_ids.include?(home.id)
      away = nil if away && confirmed_team_ids.include?(away.id)

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
      # API-resolved slots are authoritative — don't overwrite with feeders.
      next if m.external_id.present?
      # R16 pairings are not reliably modelled in R16_PAIRINGS for 2026 WC
      # cross-bracket format. Trust resolve_knockout_from_api exclusively.
      next if m.round == "Round of 16"

      home = team_for_feeder_slot(m.home_slot)
      away = team_for_feeder_slot(m.away_slot)
      m.update!(home_team: home, away_team: away) if home != m.home_team || away != m.away_team
    end
  end

  def team_for_group_slot(slot, qualifiers, standings, all_done)
    return nil if slot.blank?

    if slot.start_with?("T")
      return nil unless all_done

      group = third_place_group_for_t_slot(slot, standings)
      return nil unless group

      standings.groups[group]&.then { |ranked| ranked[2]&.team }
    else
      letter = slot[1]
      return nil unless group_complete?(letter)

      qualifiers[slot]
    end
  end

  def third_place_group_for_t_slot(slot, standings)
    winner = T_SLOT_WINNERS[slot]
    return nil unless winner

    key = third_place_combination_key(standings)
    return nil unless key

    FifaThirdPlaceAnnexC::LOOKUP[key]&.[](winner)
  end

  def third_place_combination_key(standings)
    letters = standings.third_place_table.first(8).filter_map { |s| s.team.group }.sort
    letters.join if letters.size == 8
  end

  def team_for_feeder_slot(slot)
    return nil if slot.blank?

    kind = slot[0]
    pos  = slot[1..].to_i
    feeder = @competition.matches.find_by(bracket_pos: pos)
    return nil unless feeder&.status == "finished" && feeder.home_score && feeder.away_score

    if feeder.home_score != feeder.away_score
      home_won = feeder.home_score > feeder.away_score
    elsif feeder.home_pen_score && feeder.away_pen_score
      home_won = feeder.home_pen_score > feeder.away_pen_score
    else
      return nil
    end
    case kind
    when "W" then home_won ? feeder.home_team : feeder.away_team
    when "L" then home_won ? feeder.away_team : feeder.home_team
    end
  end
end
