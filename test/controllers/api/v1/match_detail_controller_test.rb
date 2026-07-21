require "test_helper"

class Api::V1::MatchDetailControllerTest < ActionDispatch::IntegrationTest
  setup do
    Rails.cache.clear
  end

  test "show returns fixture from live scores client" do
    detail = sample_detail(external_id: 12345, home: "Arsenal", away: "Chelsea")

    fake_client = Class.new do
      define_method(:initialize) { @detail = detail }
      define_method(:match_detail) { |_id| @detail }
      define_method(:match_from_list) { |_id| nil }
    end

    with_fake_live_client(fake_client) do
      get "/api/v1/match_detail/12345"
    end

    assert_response :success
    assert_equal "Arsenal", json_response.dig(:fixture, :teams, :home, :name)
    assert_equal "Chelsea", json_response.dig(:fixture, :teams, :away, :name)
    assert_equal 2, json_response.dig(:fixture, :goals, :home)
  end

  test "show resolves db-prefixed id from local match" do
    comp  = Competition.create!(name: "World Cup 2026", code: "WC")
    home  = Team.create!(name: "Brazil", code: "BRA", flag_url: "https://example.com/bra.png")
    away  = Team.create!(name: "France", code: "FRA", flag_url: "https://example.com/fra.png")
    match = Match.create!(
      competition: comp,
      home_team: home,
      away_team: away,
      status: "finished",
      kickoff_at: 2.days.ago,
      home_score: 2,
      away_score: 1,
      external_id: 777001
    )

    fake_client = Class.new do
      define_method(:match_detail) { |_id| nil }
      define_method(:match_from_list) { |_id| nil }
    end

    with_fake_live_client(fake_client) do
      get "/api/v1/match_detail/db-#{match.id}"
    end

    assert_response :success
    assert_equal "Brazil", json_response.dig(:fixture, :teams, :home, :name)
    assert_equal "France", json_response.dig(:fixture, :teams, :away, :name)
    assert_equal 2, json_response.dig(:fixture, :goals, :home)
    assert_equal match.id, json_response.dig(:fixture, :fixture, :db_id)
    assert_equal "local", json_response[:source]
  ensure
    match&.destroy
    home&.destroy
    away&.destroy
    comp&.destroy
  end

  test "show returns not_found when api and db have no match" do
    fake_client = Class.new do
      define_method(:match_detail) { |_id| nil }
      define_method(:match_from_list) { |_id| nil }
    end

    with_fake_live_client(fake_client) do
      get "/api/v1/match_detail/999999"
    end

    assert_response :success
    assert_nil json_response[:fixture]
    assert_equal "not_found", json_response[:error]
    assert_equal [], json_response[:events]
  end

  test "show returns api_error when live scores client raises" do
    fake_client = Class.new do
      define_method(:match_detail) { |_id| raise StandardError, "upstream timeout" }
      define_method(:match_from_list) { |_id| nil }
    end

    with_fake_live_client(fake_client) do
      get "/api/v1/match_detail/12345"
    end

    assert_response :success
    assert_nil json_response[:fixture]
    assert_equal "api_error", json_response[:error]
  end

  test "db-prefixed id returns not_found for missing record" do
    fake_client = Class.new do
      define_method(:match_detail) { |_id| nil }
      define_method(:match_from_list) { |_id| nil }
    end

    with_fake_live_client(fake_client) do
      get "/api/v1/match_detail/db-0"
    end

    assert_response :success
    assert_nil json_response[:fixture]
    assert_equal "not_found", json_response[:error]
  end

  private

  def sample_detail(external_id:, home:, away:, home_score: 2, away_score: 1)
    {
      fixture: {
        "fixture" => {
          "id" => external_id,
          "date" => Time.utc(2026, 7, 21, 18, 0, 0).iso8601,
          "status" => { "short" => "FT", "long" => "Match Finished", "elapsed" => 90 }
        },
        "teams" => {
          "home" => { "id" => 1, "name" => home, "logo" => nil, "winner" => true },
          "away" => { "id" => 2, "name" => away, "logo" => nil, "winner" => false }
        },
        "goals" => { "home" => home_score, "away" => away_score }
      },
      events: [],
      stats: [],
      lineups: []
    }
  end

  def with_fake_live_client(klass)
    original = LiveScoresClient.method(:new)
    LiveScoresClient.define_singleton_method(:new) { klass.new }
    yield
  ensure
    LiveScoresClient.define_singleton_method(:new, original)
  end
end
