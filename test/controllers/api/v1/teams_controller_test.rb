require "test_helper"

class Api::V1::TeamsControllerTest < ActionDispatch::IntegrationTest
  setup do
    @wc   = wc_competition
    @home = team("AAA", group: "A")
    @away = team("BBB", group: "A")
    @match = finished(@home, @away, 2, 1, competition: @wc, group: "A")
    # A goal + stat exist but must NOT be embedded in the team's match list.
    Goal.create!(match: @match, team: @home, player_name: "Striker", minute: 10, goal_type: "regular")
  end

  test "show returns the team's matches with a minimal shape (no goals/match_stats)" do
    get "/api/v1/teams/#{@home.id}"
    assert_response :success

    body  = JSON.parse(response.body)
    match = body["matches"].find { |m| m["id"] == @match.id }
    assert match, "expected the team's match in the response"

    # Fixture-list fields are present...
    assert_equal "finished", match["status"]
    assert_equal 2, match["home_score"]
    assert match["home_team"] && match["away_team"]

    # ...but the heavy associations are not embedded (the N+1 we removed).
    refute match.key?("goals"),       "match list must not embed goals"
    refute match.key?("match_stats"), "match list must not embed match_stats"
  end

  test "show still reports tournament stats and scorers" do
    get "/api/v1/teams/#{@home.id}"
    body = JSON.parse(response.body)

    assert_equal 1, body.dig("tournament_stats", "played")
    assert_equal 2, body.dig("tournament_stats", "goals_scored")
    assert(body["scorers"].any? { |s| s["name"] == "Striker" })
  end
end
