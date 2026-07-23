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

  test "today tab requests 7-day past and future window" do
    captured = {}

    fake_client = Class.new do
      define_method(:current_season_for_league) { |_lid, _code| 2026 }
      define_method(:matches_for_league) do |_lid, from:, to:, code:, timezone:, season:|
        captured[:from] = from
        captured[:to] = to
        captured[:timezone] = timezone
        []
      end
    end

    with_fake_live_client(fake_client) do
      get "/api/v1/competitions/PL/fixtures", params: { tab: "today", date: "2026-07-21", tz: "UTC" }
    end

    assert_response :success
    assert_equal Date.parse("2026-07-14"), captured[:from]
    assert_equal Date.parse("2026-07-28"), captured[:to]
    assert_equal "UTC", captured[:timezone]
  end

  test "today tab includes live matches and filters by local date" do
    live_yesterday = sample_match(external_id: 1, status: "live", kickoff_at: Time.utc(2026, 7, 20, 15, 0, 0))
    scheduled_today = sample_match(external_id: 2, status: "scheduled", kickoff_at: Time.utc(2026, 7, 21, 18, 0, 0))
    finished_today = sample_match(external_id: 3, status: "finished", kickoff_at: Time.utc(2026, 7, 21, 12, 0, 0), home_score: 1, away_score: 0)
    scheduled_tomorrow = sample_match(external_id: 4, status: "scheduled", kickoff_at: Time.utc(2026, 7, 22, 18, 0, 0))
    rows = [ live_yesterday, scheduled_today, finished_today, scheduled_tomorrow ]

    fake_client = Class.new do
      define_method(:current_season_for_league) { |_lid, _code| 2026 }
      define_method(:matches_for_league) { |_lid, **| rows }
    end

    with_fake_live_client(fake_client) do
      get "/api/v1/competitions/PL/fixtures", params: { tab: "today", date: "2026-07-21", tz: "UTC" }
    end

    assert_response :success
    ids = json_response.map { |m| m[:external_id] }
    assert_includes ids, 1
    assert_includes ids, 2
    assert_includes ids, 3
    refute_includes ids, 4
  end

  test "today tab respects timezone for local date boundary" do
    # 02:00 UTC is still July 20 in America/New_York (EDT); 06:00 UTC is July 21 locally.
    late_utc = sample_match(external_id: 10, status: "scheduled", kickoff_at: Time.utc(2026, 7, 21, 2, 0, 0))
    early_utc = sample_match(external_id: 11, status: "scheduled", kickoff_at: Time.utc(2026, 7, 21, 6, 0, 0))
    rows = [ late_utc, early_utc ]

    fake_client = Class.new do
      define_method(:current_season_for_league) { |_lid, _code| 2026 }
      define_method(:matches_for_league) { |_lid, **| rows }
    end

    with_fake_live_client(fake_client) do
      get "/api/v1/competitions/PL/fixtures", params: { tab: "today", date: "2026-07-21", tz: "America/New_York" }
    end

    assert_response :success
    ids = json_response.map { |m| m[:external_id] }
    refute_includes ids, 10
    assert_includes ids, 11
  end

  test "display_name maps short escorpiones to escorpiones belen" do
    assert_equal "Escorpiones Belén", TeamDisplayNames.display_name("Escorpiones")
  end

  test "dedup_slug aliases stale escorpiones slug" do
    assert_equal "escorpiones-belen", TeamDisplayNames.dedup_slug("Escorpiones")
    assert_equal "escorpiones-belen", TeamDisplayNames.dedup_slug("Escorpiones Belén")
  end

  test "fixtures tab keeps real CRC kickoff dates and opener first" do
    rows = [
      crc_match(
        external_id: 1551648,
        home: "CS Herediano",
        away: "Puntarenas FC",
        kickoff_at: Time.new(2026, 7, 23, 20, 0, 0, "-06:00")
      ),
      crc_match(
        external_id: 1551649,
        home: "San Carlos",
        away: "Escorpiones Belén",
        kickoff_at: Time.new(2026, 7, 26, 17, 0, 0, "-06:00")
      )
    ]

    fake_client = Class.new do
      define_method(:current_season_for_league) { |_lid, _code| 2026 }
      define_method(:matches_for_league) { |_lid, **| rows }
    end

    with_fake_live_client(fake_client) do
      get "/api/v1/competitions/CRC/fixtures", params: { tab: "fixtures", tz: "America/Costa_Rica" }
    end

    assert_response :success
    assert_equal 2, json_response.size
    assert_equal 1551648, json_response.first[:external_id]
    assert_equal "Herediano", json_response.first.dig(:home_team, :name)
    assert_match(/2026-07-26/, json_response.last[:kickoff_at].to_s)
  end

  test "fixtures tab dedupes escorpiones short name vs full rebrand name" do
    placeholder = crc_match(
      external_id: 101,
      home: "LD Alajuelense",
      away: "Escorpiones",
      kickoff_at: Time.utc(2026, 8, 2, 20, 0, 0),
      away_logo: "https://example.com/placeholder.png",
      round: "Apertura - 2"
    )
    confirmed = crc_match(
      external_id: 201,
      home: "LD Alajuelense",
      away: "Escorpiones Belén",
      kickoff_at: Time.utc(2026, 7, 31, 2, 0, 0),
      away_logo: TeamDisplayNames::ESCORPIONES_LOGO,
      round: "Apertura - 2"
    )
    rows = [ placeholder, confirmed ]

    fake_client = Class.new do
      define_method(:current_season_for_league) { |_lid, _code| 2026 }
      define_method(:matches_for_league) { |_lid, **| rows }
    end

    with_fake_live_client(fake_client) do
      get "/api/v1/competitions/CRC/fixtures", params: { tab: "fixtures", tz: "America/Costa_Rica" }
    end

    assert_response :success
    alajuelense = json_response.select { |m| m.dig(:home_team, :name) == "Alajuelense" }
    assert_equal 1, alajuelense.size
    assert_equal 201, alajuelense.first[:external_id]
    assert_equal "Escorpiones Belén", alajuelense.first.dig(:away_team, :name)
  end

  test "fixtures tab dedupes stale rebrand duplicates for same jornada slot" do
    placeholder = crc_match(
      external_id: 100,
      home: "San Carlos",
      away: "Municipal Liberia",
      kickoff_at: Time.utc(2026, 7, 26, 20, 0, 0),
      away_logo: "https://example.com/placeholder.png"
    )
    confirmed = crc_match(
      external_id: 200,
      home: "San Carlos",
      away: "Escorpiones Belén",
      kickoff_at: Time.utc(2026, 7, 23, 23, 0, 0),
      away_logo: TeamDisplayNames::ESCORPIONES_LOGO
    )
    rows = [ placeholder, confirmed ]

    fake_client = Class.new do
      define_method(:current_season_for_league) { |_lid, _code| 2026 }
      define_method(:matches_for_league) { |_lid, **| rows }
    end

    with_fake_live_client(fake_client) do
      get "/api/v1/competitions/CRC/fixtures", params: { tab: "fixtures", tz: "America/Costa_Rica" }
    end

    assert_response :success
    san_carlos = json_response.select { |m| m.dig(:home_team, :name) == "San Carlos" }
    assert_equal 1, san_carlos.size
    match = san_carlos.first
    assert_equal 200, match[:external_id]
    assert_equal "Escorpiones Belén", match.dig(:away_team, :name)
    refute match[:kickoff_tbc]
  end

  def crc_match(external_id:, home:, away:, kickoff_at:, away_logo: nil, round: "Apertura - 1")
    {
      external_id: external_id,
      league_id: 162,
      league_name: "Primera División",
      league_logo: "https://example.com/crc.png",
      league_country: "Costa-Rica",
      round: round,
      status: "scheduled",
      kickoff_at: kickoff_at.iso8601,
      home: { name: home, logo: nil, score: nil },
      away: { name: away, logo: away_logo, score: nil }
    }
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
