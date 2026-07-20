require "test_helper"

class Api::V1::CompetitionFixturesControllerTest < ActionDispatch::IntegrationTest
  test "returns wider fixture window for fixtures tab" do
    rows = [ sample_match(external_id: 1, status: "scheduled", kickoff_at: 5.days.from_now) ]
    window_days = nil

    fake_client = Class.new do
      define_method(:current_season_for_league) { |_lid, _code| 2026 }
      define_method(:matches_for_league) do |_lid, from:, to:, code:, timezone:, season:|
        window_days = (to - from).to_i
        rows
      end
    end

    with_fake_live_client(fake_client) do
      get "/api/v1/competitions/PL/fixtures", params: { tab: "fixtures", tz: "UTC" }
    end

    assert_response :success
    assert_equal 60, window_days
    assert_equal 1, json_response.size
    assert_equal "scheduled", json_response.first[:status]
  end

  test "falls back to previous season when current returns no results" do
    finished = sample_match(external_id: 9, status: "finished", kickoff_at: 10.days.ago, home_score: 2, away_score: 1)
    seasons_used = []

    fake_client = Class.new do
      define_method(:current_season_for_league) { |_lid, _code| 2026 }
      define_method(:matches_for_league) do |_lid, from:, to:, code:, timezone:, season:|
        seasons_used << season
        season == 2026 ? [] : [ finished ]
      end
    end

    with_fake_live_client(fake_client) do
      get "/api/v1/competitions/PL/fixtures", params: { tab: "results", tz: "UTC" }
    end

    assert_response :success
    assert_equal 1, json_response.size
    assert_equal "finished", json_response.first[:status]
    assert_includes seasons_used, 2025
  end

  private

  def sample_match(external_id:, status:, kickoff_at:, home_score: nil, away_score: nil)
    {
      external_id: external_id,
      league_id: 39,
      league_name: "Premier League",
      league_logo: "https://example.com/pl.png",
      league_country: "England",
      round: "Regular Season - 1",
      status: status,
      kickoff_at: kickoff_at.iso8601,
      home: { name: "Arsenal", logo: nil, score: home_score },
      away: { name: "Chelsea", logo: nil, score: away_score }
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
