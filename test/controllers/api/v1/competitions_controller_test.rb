require "test_helper"

class Api::V1::CompetitionsControllerTest < ActionDispatch::IntegrationTest
  setup do
    Competition.find_or_create_by!(code: "WC") do |c|
      c.name = "FIFA World Cup 2026"
      c.competition_type = "world_cup"
      c.country = "World"
    end
    Competition.find_or_create_by!(code: "CRC") do |c|
      c.name = "Liga Tica"
      c.competition_type = "league"
      c.country = "Costa Rica"
    end
  end

  test "includes archived WC in clubs mode" do
    with_app_focus("clubs") do
      get "/api/v1/competitions"
    end

    assert_response :success
    codes = json_response.map { |c| c[:code] }
    assert_includes codes, "WC"
    assert_includes codes, "CRC"

    wc = json_response.find { |c| c[:code] == "WC" }
    assert wc[:archived]
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
