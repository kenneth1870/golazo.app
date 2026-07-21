require "test_helper"

class Api::V1::LiveScoresControllerTest < ActionDispatch::IntegrationTest
  test "index returns empty array when live scores client raises" do
    fake_client = Class.new do
      define_method(:live_matches) { raise StandardError, "upstream error" }
    end

    with_fake_live_client(fake_client) do
      get "/api/v1/live_scores"
    end

    assert_response :success
    assert_equal [], json_response
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
