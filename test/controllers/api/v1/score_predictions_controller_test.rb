require "test_helper"

class Api::V1::ScorePredictionsControllerTest < ActionDispatch::IntegrationTest
  test "create rejects prediction when match already started" do
    comp  = Competition.create!(name: "Test Cup", code: "ZSP")
    home  = Team.create!(name: "Japan", code: "JPN", flag_url: "https://example.com/jpn.png")
    away  = Team.create!(name: "Spain", code: "ESP", flag_url: "https://example.com/esp.png")
    match = Match.create!(
      competition: comp,
      home_team: home,
      away_team: away,
      status: "live",
      kickoff_at: 1.hour.ago,
      external_id: 88001
    )

    post "/api/v1/score_predictions/#{match.external_id}",
         params: {
           device_id: "test-device-abc",
           home_guess: 1,
           away_guess: 0,
           home_team_name: home.name,
           away_team_name: away.name
         },
         as: :json

    assert_response :unprocessable_entity
    assert_equal "match_already_started", json_response[:error]
  ensure
    match&.destroy
    home&.destroy
    away&.destroy
    comp&.destroy
  end

  test "create stores prediction for upcoming match" do
    comp  = Competition.create!(name: "Test Cup", code: "ZSP")
    home  = Team.create!(name: "Mexico", code: "MEX", flag_url: "https://example.com/mex.png")
    away  = Team.create!(name: "Canada", code: "CAN", flag_url: "https://example.com/can.png")
    match = Match.create!(
      competition: comp,
      home_team: home,
      away_team: away,
      status: "scheduled",
      kickoff_at: 2.days.from_now,
      external_id: 88002
    )

    post "/api/v1/score_predictions/#{match.external_id}",
         params: {
           device_id: "test-device-xyz",
           home_guess: 2,
           away_guess: 1,
           display_name: "Tester",
           home_team_name: home.name,
           away_team_name: away.name
         },
         as: :json

    assert_response :created
    assert_equal 2, json_response[:home_guess]
    assert_equal 1, json_response[:away_guess]
    assert_equal "Tester", json_response[:display_name]
  ensure
    ScorePrediction.where(device_id: "test-device-xyz").delete_all
    match&.destroy
    home&.destroy
    away&.destroy
    comp&.destroy
  end
end
