require "test_helper"

class WorldCupStandingsTest < ActiveSupport::TestCase
  setup { @wc = wc_competition }

  test "ranks by points, then goal difference, then head-to-head" do
    a = %w[GA1 GA2 GA3 GA4].map { |c| team(c, group: "A") }

    # Full round robin. GA1, GA2 and GA4 all finish on 6 pts.
    # GA1 & GA2 tie on points(6)/GD(+2)/GF(3); GA1 won their head-to-head 1-0.
    # GA4 also has 6 pts but GD +1, so ranks below both.
    round_robin(a, [
      [ 0, 1, 1, 0 ], # GA1 beats GA2 (head-to-head)
      [ 0, 2, 2, 0 ], # GA1 beats GA3
      [ 3, 0, 1, 0 ], # GA4 beats GA1
      [ 1, 2, 2, 0 ], # GA2 beats GA3
      [ 1, 3, 1, 0 ], # GA2 beats GA4
      [ 3, 2, 1, 0 ] # GA4 beats GA3
    ], competition: @wc, group: "A")

    ranked = WorldCupStandings.new(@wc).groups["A"]

    assert_equal %w[GA1 GA2 GA4 GA3], ranked.map { |s| s.team.code },
      "GA1 over GA2 by head-to-head; GA4 third on GD; GA3 last"
    assert_equal 6, ranked[0].points
    assert_equal 2, ranked[0].goal_difference
    assert_equal 0, ranked.last.points
  end

  test "qualifiers expose group winner and runner-up" do
    a = %w[GA1 GA2 GA3 GA4].map { |c| team(c, group: "A") }
    # GA1 wins all (9), GA2 second (6), GA3/GA4 draw for the rest.
    round_robin(a, [
      [ 0, 2, 2, 0 ], [ 0, 3, 2, 0 ], [ 0, 1, 1, 0 ],
      [ 1, 2, 1, 0 ], [ 1, 3, 1, 0 ], [ 2, 3, 0, 0 ]
    ], competition: @wc, group: "A")

    q = WorldCupStandings.new(@wc).qualifiers
    assert_equal "GA1", q["1A"].code
    assert_equal "GA2", q["2A"].code
  end

  test "best thirds rank third-placed teams across groups" do
    a = %w[GA1 GA2 GA3 GA4].map { |c| team(c, group: "A") }
    b = %w[GB1 GB2 GB3 GB4].map { |c| team(c, group: "B") }

    # Group A: GA4 finishes 3rd with 6 points.
    round_robin(a, [
      [ 0, 1, 1, 0 ], [ 0, 2, 2, 0 ], [ 3, 0, 1, 0 ],
      [ 1, 2, 2, 0 ], [ 1, 3, 1, 0 ], [ 3, 2, 1, 0 ]
    ], competition: @wc, group: "A")

    # Group B: only one game → GB4 finishes 3rd with 0 points.
    finished(b[0], b[1], 3, 0, competition: @wc, group: "B")

    thirds = WorldCupStandings.new(@wc).best_thirds
    assert_equal %w[GA4 GB4], thirds.map { |s| s.team.code },
      "GA4 (6 pts) ranks above GB4 (0 pts)"
  end
end
