require "test_helper"

class Api::V1::SearchControllerTest < ActionDispatch::IntegrationTest
  test "returns club teams from standings cache in clubs mode" do
    rows = [
      {
        "rank" => 1,
        "group" => "Overall",
        "team" => { "name" => "Deportivo Saprissa", "logo" => "https://example.com/s.png" },
        "all" => { "played" => 1, "win" => 1, "draw" => 0, "lose" => 0, "goals" => { "for" => 2, "against" => 0 } },
        "goalsDiff" => 2,
        "points" => 3
      }
    ]

    fake_client = Class.new do
      define_method(:current_season_for_league) { |_league_id, _code| 2025 }
      define_method(:league_standings) { |league_id, _season| league_id == 162 ? rows : [] }
      define_method(:matches_for_date) { |_date| [] }
    end

    with_fake_live_client(fake_client) do
      get "/api/v1/search", params: { q: "sap" }
    end

    assert_response :success
    teams = json_response.select { |r| r[:type] == "team" && r[:league_code] == "CRC" }
    assert teams.any?, "expected CRC club team in search results"
    sap = teams.find { |t| t[:name] == "Saprissa" }
    assert_equal "saprissa", sap[:slug]
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
