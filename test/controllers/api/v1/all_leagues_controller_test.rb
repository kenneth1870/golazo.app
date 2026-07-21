require "test_helper"

class Api::V1::AllLeaguesControllerTest < ActionDispatch::IntegrationTest
  test "index returns leagues from live scores client" do
    fake_client = Class.new do
      define_method(:leagues) { [ { id: 39, name: "Premier League" } ] }
      define_method(:live_matches) { [] }
    end

    with_fake_live_client(fake_client) do
      get "/api/v1/all_leagues"
    end

    assert_response :success
    assert_equal 1, json_response.size
    assert_equal "Premier League", json_response.first[:name]
  end

  test "live returns capped live match payload" do
    fake_client = Class.new do
      define_method(:leagues) { [] }
      define_method(:live_matches) do
        Array.new(60) { { external_id: 1, status: "live", league_id: 39, league_name: "Premier League" } }
      end
    end

    with_fake_live_client(fake_client) do
      get "/api/v1/all_leagues/live"
    end

    assert_response :success
    assert_equal 50, json_response[:matches].size
    assert_equal 60, json_response[:count]
  end

  private

  def with_fake_live_client(klass)
    original = LiveScoresClient.method(:new)
    LiveScoresClient.define_singleton_method(:new) { klass.new }
    yield
  ensure
    LiveScoresClient.define_singleton_method(:new, original)
  end
end
