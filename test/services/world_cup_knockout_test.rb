require "test_helper"

class WorldCupKnockoutTest < ActiveSupport::TestCase
  setup { @wc = wc_competition }

  test "ensure_fixtures! creates the full 32-match bracket" do
    WorldCupKnockout.new(competition: @wc).ensure_fixtures!

    ko = @wc.matches.knockout
    assert_equal 32, ko.count
    assert_equal 16, ko.where(round: "Round of 32").count
    assert_equal 8,  ko.where(round: "Round of 16").count
    assert_equal 4,  ko.where(round: "Quarter Final").count
    assert_equal 2,  ko.where(round: "Semi Final").count
    assert_equal 1,  ko.where(round: "3rd Place").count
    assert_equal 1,  ko.where(round: "Final").count
  end

  test "ensure_fixtures! is idempotent" do
    builder = WorldCupKnockout.new(competition: @wc)
    builder.ensure_fixtures!
    assert_no_difference -> { @wc.matches.knockout.count } do
      builder.ensure_fixtures!
    end
  end

  test "R32 slots stay TBD until the feeding group is complete" do
    a = %w[GA1 GA2 GA3 GA4].map { |c| team(c, group: "A") }
    # Group A only partially played → not complete.
    finished(a[0], a[1], 1, 0, competition: @wc, group: "A")

    builder = WorldCupKnockout.new(competition: @wc)
    builder.ensure_fixtures!
    builder.rebuild!

    pos1 = @wc.matches.find_by(bracket_pos: 1) # home slot "1A"
    assert_nil pos1.home_team, "group A not complete → still TBD"
  end

  test "R32 group slots resolve once the group is complete" do
    a = %w[GA1 GA2 GA3 GA4].map { |c| team(c, group: "A") }
    round_robin(a, [
      [ 0, 1, 1, 0 ], [ 0, 2, 1, 0 ], [ 0, 3, 1, 0 ],
      [ 1, 2, 1, 0 ], [ 1, 3, 1, 0 ], [ 2, 3, 1, 0 ]
    ], competition: @wc, group: "A") # GA1 wins all, GA2 second
    # A second, incomplete group means the best-third ranking isn't final yet.
    %w[GB1 GB2 GB3 GB4].each { |c| team(c, group: "B") }

    builder = WorldCupKnockout.new(competition: @wc)
    builder.ensure_fixtures!
    builder.rebuild!

    assert_equal "GA1", @wc.matches.find_by(bracket_pos: 7).home_team.code  # slot 1A (pos 7 in R32_SLOTS)
    assert_equal "GA2", @wc.matches.find_by(bracket_pos: 1).home_team.code  # slot 2A (pos 1 in R32_SLOTS)
    assert_nil @wc.matches.find_by(bracket_pos: 7).away_team, "T3 slot needs all groups complete"
  end

  test "winners propagate from R32 into R16" do
    t = %w[KO1 KO2 KO3 KO4].map { |c| team(c) }
    builder = WorldCupKnockout.new(competition: @wc)
    builder.ensure_fixtures!

    # R16_PAIRINGS[1] = [1, 3] → bracket_pos 18 feeds from winners of R32 pos 1 and 3
    @wc.matches.find_by(bracket_pos: 1).update!(home_team: t[0], away_team: t[1], status: "finished", home_score: 2, away_score: 0)
    @wc.matches.find_by(bracket_pos: 3).update!(home_team: t[2], away_team: t[3], status: "finished", home_score: 0, away_score: 1)

    builder.rebuild!

    r16 = @wc.matches.find_by(bracket_pos: 18) # W1 vs W3
    assert_equal "KO1", r16.home_team.code
    assert_equal "KO4", r16.away_team.code
  end
end
