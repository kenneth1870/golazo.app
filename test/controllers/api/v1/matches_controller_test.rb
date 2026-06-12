require "test_helper"

class Api::V1::MatchesControllerTest < ActionDispatch::IntegrationTest
  setup do
    @wc    = wc_competition
    @match = Match.create!(
      home_team: team("AAA"), away_team: team("BBB"),
      competition: @wc, status: "scheduled", kickoff_at: Time.current
    )
  end

  test "update is rejected without an admin token" do
    patch "/api/v1/matches/#{@match.id}",
      params: { match: { home_score: 3, away_score: 1, status: "finished" } }

    assert_response :unauthorized
    assert_nil @match.reload.home_score, "score must not change when unauthorized"
  end

  test "update is rejected with the wrong token" do
    with_admin_token("right") do
      patch "/api/v1/matches/#{@match.id}",
        params: { match: { status: "finished" } },
        headers: { "Authorization" => "Bearer wrong" }
    end
    assert_response :unauthorized
  end

  test "update succeeds with the correct admin token" do
    with_admin_token("s3cret") do
      patch "/api/v1/matches/#{@match.id}",
        params: { match: { home_score: 2, away_score: 0, status: "finished" } },
        headers: { "Authorization" => "Bearer s3cret" }
    end

    assert_response :success
    assert_equal 2, @match.reload.home_score
    assert_equal "finished", @match.status
  end

  test "read endpoints stay public" do
    get "/api/v1/matches/db-#{@match.id}"
    assert_response :success
  end

  private

  def with_admin_token(token)
    prev = ENV["ADMIN_API_TOKEN"]
    ENV["ADMIN_API_TOKEN"] = token
    yield
  ensure
    ENV["ADMIN_API_TOKEN"] = prev
  end
end
