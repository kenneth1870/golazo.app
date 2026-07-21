require "test_helper"

class Api::V1::PredictionsControllerTest < ActionDispatch::IntegrationTest
  MATCH_ID = "88010"

  setup do
    Rails.cache.clear
  end

  test "show returns empty result when no votes yet" do
    get "/api/v1/predictions/#{MATCH_ID}"

    assert_response :success
    assert_equal MATCH_ID, json_response[:match_external_id].to_s
    assert_equal 0, json_response[:total]
    assert_equal 0, json_response[:home_votes]
  end

  test "vote records choice and show returns updated totals" do
    post "/api/v1/predictions/#{MATCH_ID}/vote",
         params: { choice: "home", device_id: "test-device-pred-1", token: "tok-abc" },
         as: :json

    assert_response :success
    assert_equal 1, json_response[:home_votes]
    assert_equal 1, json_response[:total]
    assert_equal 100, json_response[:home_pct]

    get "/api/v1/predictions/#{MATCH_ID}"
    assert_equal 1, json_response[:home_votes]
  ensure
    Prediction.where(match_external_id: MATCH_ID).delete_all
  end

  test "vote returns already_voted when device votes twice within rate limit window" do
    post "/api/v1/predictions/#{MATCH_ID}/vote",
         params: { choice: "away", device_id: "test-device-pred-2", token: "tok-xyz" },
         as: :json
    assert_response :success

    post "/api/v1/predictions/#{MATCH_ID}/vote",
         params: { choice: "home", device_id: "test-device-pred-2", token: "tok-xyz" },
         as: :json

    assert_response :unprocessable_entity
    assert_equal "already_voted", json_response[:error]
  ensure
    Prediction.where(match_external_id: MATCH_ID).delete_all
  end

  test "vote rejects invalid choice" do
    post "/api/v1/predictions/#{MATCH_ID}/vote",
         params: { choice: "invalid", device_id: "test-device-pred-3", token: "tok-bad" },
         as: :json

    assert_response :unprocessable_entity
    assert_equal "invalid_choice", json_response[:error]
  ensure
    Prediction.where(match_external_id: MATCH_ID).delete_all
  end
end
