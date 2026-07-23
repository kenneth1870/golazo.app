require "test_helper"

class Api::V1::StandingsControllerTest < ActionDispatch::IntegrationTest
  setup do
    Rails.cache.clear
  end

  test "index returns empty hash when external standings client raises" do
    fake_client = Class.new do
      define_method(:league_standings_for_code) { |_code| raise StandardError, "upstream error" }
    end

    with_fake_live_client(fake_client) do
      get "/api/v1/standings", params: { competition: "PL" }
    end

    assert_response :success
    assert_equal({}, json_response)
  end

  test "best_thirds returns empty array when WC competition is missing" do
    Rails.cache.clear
    wc = Competition.find_by(code: "WC")
    original_code = wc&.code

    begin
      wc&.update_column(:code, "WC_MISSING_TEST")
      get "/api/v1/standings/best_thirds"
      assert_response :success
      assert_equal [], json_response
    ensure
      wc&.update_column(:code, original_code) if wc && original_code
      Rails.cache.clear
    end
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
