require "test_helper"

class Api::V1::MatchFeedControllersTest < ActionDispatch::IntegrationTest
  test "today returns 503 when live scores API fails" do
    with_failing_live_client do
      get "/api/v1/today", params: { tz: "America/Costa_Rica" }
    end

    assert_response :service_unavailable
    assert_equal [], json_response
  end

  test "live_scores returns 503 when live scores API fails" do
    with_failing_live_client do
      get "/api/v1/live_scores"
    end

    assert_response :service_unavailable
    assert_equal [], json_response
  end

  test "live_count returns 503 when live scores API fails" do
    with_failing_live_client do
      get "/api/v1/live_count"
    end

    assert_response :service_unavailable
    assert_equal({ count: 0 }, json_response)
  end

  test "results returns 503 when live scores API fails" do
    with_failing_live_client do
      get "/api/v1/results", params: { date: "2026-07-30", tz: "America/Costa_Rica" }
    end

    assert_response :service_unavailable
    assert_equal [], json_response
  end

  test "competition fixtures returns 503 when live scores API fails" do
    with_failing_live_client do
      get "/api/v1/competitions/CRC/fixtures", params: { tab: "today", tz: "America/Costa_Rica" }
    end

    assert_response :service_unavailable
    assert_equal [], json_response
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
    end

    original = LiveScoresClient.method(:new)
    LiveScoresClient.define_singleton_method(:new) { fake_client.new }
    yield
  ensure
    LiveScoresClient.define_singleton_method(:new, original)
    Rails.cache = original_cache
  end
end
