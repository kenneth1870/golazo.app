require "test_helper"

class Api::V1::TodayControllerTest < ActionDispatch::IntegrationTest
  setup do
    Rails.cache.clear
  end

  test "returns LATAM jornada matches on adjusted local date in clubs mode" do
    # API stacks CRC jornada on Sunday; adjusted_kickoff shifts to Thursday.
    sunday_kickoff = Time.utc(2026, 7, 26, 20, 0, 0)
    crc_match = sample_match(
      external_id: 99001,
      league_id: 162,
      league_name: "Primera División",
      league_country: "Costa-Rica",
      round: "Apertura - 1",
      status: "scheduled",
      kickoff_at: sunday_kickoff
    )

    fake_client = Class.new do
      define_method(:initialize) { @crc = crc_match }
      define_method(:current_season_for_league) { |_lid, code| code == "CRC" ? 2026 : 2025 }
      define_method(:matches_for_league) do |league_id, from:, to:, code:, timezone:, season:|
        league_id == 162 ? [ @crc ] : []
      end
      define_method(:matches_for_date) { |_date, timezone: nil| [] }
    end

    with_fake_live_client(fake_client) do
      get "/api/v1/today", params: { date: "2026-07-23", tz: "America/Costa_Rica" }
    end

    assert_response :success
    crc = json_response.select { |m| m.dig(:competition, :code) == "CRC" }
    assert_equal 1, crc.size
    assert_equal "Herediano", crc.first.dig(:home_team, :name)
    assert_equal "Puntarenas FC", crc.first.dig(:away_team, :name)
    assert_match(/2026-07-23/, crc.first[:kickoff_at].to_s)
  end

  private

  def sample_match(external_id:, league_id:, league_name:, league_country:, round:, status:, kickoff_at:, home_score: nil, away_score: nil)
    {
      external_id: external_id,
      league_id: league_id,
      league_name: league_name,
      league_logo: "https://example.com/league.png",
      league_country: league_country,
      round: round,
      status: status,
      kickoff_at: kickoff_at.iso8601,
      home: { name: "Herediano", logo: nil, score: home_score },
      away: { name: "Puntarenas FC", logo: nil, score: away_score }
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
