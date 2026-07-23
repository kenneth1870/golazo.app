require "test_helper"

class HomeSmokeTest < ActionDispatch::IntegrationTest
  test "GET / returns SPA shell with root mount point" do
    get "/"
    assert_response :success
    assert_includes response.body, 'id="root"'
    assert_match %r{/vite-test/assets/application-[^"]+\.js}, response.body
  end

  test "GET /scores/today returns SPA shell" do
    get "/scores/today"
    assert_response :success
    assert_includes response.body, 'id="root"'
  end
end
