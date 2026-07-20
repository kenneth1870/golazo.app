require "test_helper"

class Api::V1::ConfigControllerTest < ActionDispatch::IntegrationTest
  test "GET config returns focus settings" do
    get "/api/v1/config"
    assert_response :success

    body = JSON.parse(response.body)
    assert_equal "clubs", body["focus"]
    assert body["wc_paused"]
    assert body["clubs_primary"]
    assert_includes body["featured_clubs"], "PL"
    assert body["featured_leagues"].any? { |l| l["code"] == "PL" && l["league_id"] == 39 }
  end
end
