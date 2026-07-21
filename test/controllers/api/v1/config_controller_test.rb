require "test_helper"

class Api::V1::ConfigControllerTest < ActionDispatch::IntegrationTest
  test "show returns app focus configuration" do
    get "/api/v1/config"

    assert_response :success
    assert json_response.key?(:focus)
    assert json_response.key?(:clubs_primary)
    assert json_response.key?(:featured_leagues)
    assert json_response[:featured_leagues].is_a?(Array)
  end
end
