require "test_helper"

class Api::V1::MatchReactionsControllerTest < ActionDispatch::IntegrationTest
  MATCH_ID = "99001"

  setup do
    Rails.cache.clear
  end

  test "show returns empty counts for match with no reactions" do
    get "/api/v1/matches/#{MATCH_ID}/reactions"

    assert_response :success
    assert_equal({}, json_response)
  end

  test "create rejects invalid emoji" do
    post "/api/v1/matches/#{MATCH_ID}/reactions",
         params: { emoji: "🚀" },
         as: :json

    assert_response :unprocessable_entity
    assert_equal "invalid emoji", json_response[:error]
  end

  test "create increments reaction count for valid emoji" do
    post "/api/v1/matches/#{MATCH_ID}/reactions",
         params: { emoji: "⚽" },
         as: :json

    assert_response :success
    assert_equal 1, json_response[:"⚽"]

    get "/api/v1/matches/#{MATCH_ID}/reactions"
    assert_equal 1, json_response[:"⚽"]
  ensure
    MatchReaction.where(match_id: MATCH_ID).delete_all
  end

  test "create rate limits duplicate emoji from same ip" do
    original_cache = Rails.cache
    Rails.cache = ActiveSupport::Cache.lookup_store(:memory_store)
    Rails.cache.clear

    post "/api/v1/matches/#{MATCH_ID}/reactions",
         params: { emoji: "🔥" },
         as: :json
    assert_equal 1, json_response[:"🔥"]

    post "/api/v1/matches/#{MATCH_ID}/reactions",
         params: { emoji: "🔥" },
         as: :json

    assert_response :success
    assert_equal 1, json_response[:"🔥"]
  ensure
    MatchReaction.where(match_id: MATCH_ID).delete_all
    Rails.cache = original_cache if defined?(original_cache)
  end
end
