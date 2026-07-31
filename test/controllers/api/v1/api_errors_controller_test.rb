require "test_helper"

class Api::V1::ApiErrorsControllerTest < ActionDispatch::IntegrationTest
  test "search returns 503 when live scores API fails" do
    with_failing_live_client do
      get "/api/v1/search", params: { q: "sap" }
    end

    assert_response :service_unavailable
    assert_equal [], json_response
  end

  test "club teams index returns 503 when standings cache read fails" do
    original = Api::V1::ClubTeamsController.instance_method(:cached_standings)
    Api::V1::ClubTeamsController.define_method(:cached_standings) { |*_args| raise "cache down" }
    get "/api/v1/club_teams"
    assert_response :service_unavailable
    assert_equal [], json_response
  ensure
    Api::V1::ClubTeamsController.define_method(:cached_standings, original)
  end

  test "news index returns 503 when news service fails" do
    fake_service = Class.new do
      define_method(:latest) { |**_kwargs| raise "feed down" }
    end
    original = NewsService.method(:new)
    NewsService.define_singleton_method(:new) { fake_service.new }
    get "/api/v1/news"
    assert_response :service_unavailable
    assert_equal [], json_response
  ensure
    NewsService.define_singleton_method(:new, original)
  end

  test "top scorers returns 503 when live scores API fails" do
    with_failing_live_client do
      get "/api/v1/top_scorers", params: { competition: "PL" }
    end

    assert_response :service_unavailable
    assert_equal [], json_response
  end

  test "standings returns 503 and does not cache API failures" do
    memory_cache = ActiveSupport::Cache::MemoryStore.new
    original_cache = Rails.cache
    Rails.cache = memory_cache

    fake_client = Class.new do
      define_method(:league_standings_for_code) { |_code| raise "API down" }
    end
    original = LiveScoresClient.method(:new)
    LiveScoresClient.define_singleton_method(:new) { fake_client.new }

    get "/api/v1/standings", params: { competition: "CRC" }
    assert_response :service_unavailable
    assert_nil Rails.cache.read("standings_CRC")
  ensure
    LiveScoresClient.define_singleton_method(:new, original)
    Rails.cache = original_cache
  end

  private

  def with_failing_live_client
    original_cache = Rails.cache
    Rails.cache = ActiveSupport::Cache::NullStore.new

    fake_client = Class.new do
      define_method(:matches_for_date) { |*_args| raise "API down" }
      define_method(:live_matches) { raise "API down" }
      define_method(:current_season_for_league) { |*_args| 2025 }
      define_method(:matches_for_league) { |*_args| raise "API down" }
      define_method(:league_standings) { |*_args| raise "API down" }
      define_method(:search_players) { |*_args| raise "API down" }
    end

    original = LiveScoresClient.method(:new)
    LiveScoresClient.define_singleton_method(:new) { fake_client.new }
    yield
  ensure
    LiveScoresClient.define_singleton_method(:new, original)
    Rails.cache = original_cache
  end
end
