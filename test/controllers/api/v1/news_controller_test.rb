require "test_helper"

class Api::V1::NewsControllerTest < ActionDispatch::IntegrationTest
  test "index returns empty array when news service raises" do
    fake_service = Class.new do
      define_method(:latest) { |_opts| raise StandardError, "feed unavailable" }
    end

    with_fake_news_service(fake_service) do
      get "/api/v1/news"
    end

    assert_response :success
    assert_equal [], json_response
  end

  private

  def with_fake_news_service(klass)
    original = NewsService.method(:new)
    NewsService.define_singleton_method(:new) { klass.new }
    yield
  ensure
    NewsService.define_singleton_method(:new, original)
  end
end
