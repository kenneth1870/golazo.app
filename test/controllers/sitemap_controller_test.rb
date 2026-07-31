require "test_helper"

class SitemapControllerTest < ActionDispatch::IntegrationTest
  test "clubs mode sitemap includes live scores page" do
    with_focus("clubs") do
      get "/sitemap.xml"
    end

    assert_response :success
    assert_includes response.body, "/scores/live"
  end

  private

  def with_focus(value)
    original = ENV["APP_FOCUS"]
    ENV["APP_FOCUS"] = value
    reload_focus!
    yield
  ensure
    if original.nil?
      ENV.delete("APP_FOCUS")
    else
      ENV["APP_FOCUS"] = original
    end
    reload_focus!
  end

  def reload_focus!
    AppFocus.send(:remove_const, :FOCUS)
    AppFocus.const_set(:FOCUS, ENV.fetch("APP_FOCUS", "clubs").freeze)
  end
end
