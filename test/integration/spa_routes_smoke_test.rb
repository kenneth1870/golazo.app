require "test_helper"

class SpaRoutesSmokeTest < ActionDispatch::IntegrationTest
  %w[/ /scores/today /scores/live /news /leagues].each do |path|
    test "GET #{path} returns SPA shell" do
      get path
      assert_response :success
      assert_includes response.body, 'id="root"'
      assert_match %r{/vite-test/assets/application-[^"]+\.js}, response.body
    end
  end
end
