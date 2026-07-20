require "test_helper"

class Api::V1::TeamsControllerTest < ActionDispatch::IntegrationTest
  test "clubs mode redirects WC national teams to leagues" do
    team = Team.create!(name: "Test Nation", code: "ZZZ", group: "A", flag_url: "https://example.com/zz.png")

    with_app_focus("clubs") do
      get "/api/v1/teams/#{team.id}"
    end

    assert_response :success
    body = json_response
    assert body[:wc_archived]
    assert_equal "/leagues", body[:redirect]
    assert_empty body[:matches]
  ensure
    team&.destroy
  end

  test "clubs mode maps seeded club teams to club profile path" do
    team = Team.create!(name: "Arsenal", code: "ARS", flag_url: "https://example.com/ars.png")

    with_app_focus("clubs") do
      get "/api/v1/teams/#{team.id}"
    end

    assert_response :success
    body = json_response
    assert_equal "PL", body[:club_league_code]
    assert_equal "arsenal", body[:club_slug]
    assert_equal "/leagues/PL/teams/arsenal", body[:redirect]
  ensure
    team&.destroy
  end

  private

  def with_app_focus(value)
    original = ENV["APP_FOCUS"]
    ENV["APP_FOCUS"] = value
    AppFocus.send(:remove_const, :FOCUS)
    AppFocus.const_set(:FOCUS, value.freeze)
    yield
  ensure
    if original.nil?
      ENV.delete("APP_FOCUS")
    else
      ENV["APP_FOCUS"] = original
    end
    AppFocus.send(:remove_const, :FOCUS)
    AppFocus.const_set(:FOCUS, ENV.fetch("APP_FOCUS", "clubs").freeze)
  end
end
