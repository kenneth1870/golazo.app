require "test_helper"

class Api::V1::ClubTeamsControllerTest < ActionDispatch::IntegrationTest
  test "index returns deduped club teams from cached standings" do
    grouped = {
      "Overall" => [
        {
          rank: 1,
          group_name: "Overall",
          team: { name: "Saprissa", code: "SAP", flag_url: "https://example.com/s.png" },
          played: 1, won: 1, drawn: 0, lost: 0,
          goals_for: 2, goals_against: 0, goal_diff: 2, points: 3
        }
      ]
    }

    memory_cache = ActiveSupport::Cache::MemoryStore.new
    original_cache = Rails.cache
    Rails.cache = memory_cache
    Rails.cache.write("standings_CRC", grouped)

    get "/api/v1/club_teams"
    assert_response :success
    body = json_response
    assert body.is_a?(Array)
    sap = body.find { |t| t[:name] == "Saprissa" }
    assert sap
    assert_equal "CRC", sap[:league_code]
  ensure
    Rails.cache = original_cache
  end
end
