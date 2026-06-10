require "test_helper"

class LiveScoresClientTest < ActiveSupport::TestCase
  setup do
    # Constructor only reads the key — no network call happens here.
    ENV["APISPORTS_KEY"] = "test-key"
    @client = LiveScoresClient.new
  end

  teardown { ENV.delete("APISPORTS_KEY") }

  # ── STATUS_MAP ────────────────────────────────────────────────────────────

  test "STATUS_MAP maps finished codes" do
    assert_equal "finished", LiveScoresClient::STATUS_MAP["FT"]
    assert_equal "finished", LiveScoresClient::STATUS_MAP["AET"]
    assert_equal "finished", LiveScoresClient::STATUS_MAP["PEN"]
  end

  test "STATUS_MAP maps live codes" do
    assert_equal "live", LiveScoresClient::STATUS_MAP["1H"]
    assert_equal "live", LiveScoresClient::STATUS_MAP["HT"]
    assert_equal "live", LiveScoresClient::STATUS_MAP["2H"]
  end

  test "STATUS_MAP maps scheduled codes" do
    assert_equal "scheduled", LiveScoresClient::STATUS_MAP["NS"]
    assert_equal "scheduled", LiveScoresClient::STATUS_MAP["TBD"]
  end

  test "STATUS_MAP maps postponed codes" do
    assert_equal "postponed", LiveScoresClient::STATUS_MAP["PST"]
    assert_equal "postponed", LiveScoresClient::STATUS_MAP["CANC"]
  end

  test "STATUS_MAP returns nil for unknown codes" do
    assert_nil LiveScoresClient::STATUS_MAP["UNKNOWN"]
  end

  # ── featured_league? ──────────────────────────────────────────────────────

  test "featured_league? keeps FIFA World Cup" do
    match = { league_id: 1, league_name: "FIFA World Cup", league_country: "World" }
    assert @client.send(:featured_league?, match)
  end

  test "featured_league? keeps Premier League" do
    match = { league_id: 39, league_name: "Premier League", league_country: "England" }
    assert @client.send(:featured_league?, match)
  end

  test "featured_league? drops unknown league IDs" do
    match = { league_id: 99_999, league_name: "Obscure League", league_country: "XY" }
    refute @client.send(:featured_league?, match)
  end

  test "featured_league? drops women's competitions by name" do
    match = { league_id: 1, league_name: "Women's World Cup", league_country: "World" }
    refute @client.send(:featured_league?, match)
  end

  test "featured_league? drops youth competitions by name" do
    match = { league_id: 39, league_name: "Premier League U21", league_country: "England" }
    refute @client.send(:featured_league?, match)
  end

  # ── normalize_fixture ─────────────────────────────────────────────────────

  test "normalize_fixture builds expected shape for a finished match" do
    raw = {
      "fixture" => {
        "id"     => 999,
        "date"   => "2026-06-15T15:00:00+00:00",
        "status" => { "short" => "FT", "elapsed" => 90 },
        "venue"  => { "name" => "Lusail", "city" => "Lusail" }
      },
      "league"  => {
        "id" => 1, "name" => "FIFA World Cup",
        "country" => "World", "round" => "Group Stage - 1",
        "logo" => "https://example.com/logo.png",
        "flag" => nil
      },
      "teams"   => {
        "home" => { "id" => 10, "name" => "Brazil", "logo" => "https://example.com/bra.png", "winner" => true },
        "away" => { "id" => 20, "name" => "Germany", "logo" => "https://example.com/ger.png", "winner" => false }
      },
      "goals"   => { "home" => 2, "away" => 1 },
      "score"   => {}
    }

    m = @client.send(:normalize_fixture, raw)

    assert_equal 999, m[:external_id]
    assert_equal "finished", m[:status]
    assert_equal "FT", m[:status_short]
    assert_equal 90, m[:minute]
    assert_equal 1,  m[:league_id]
    assert_equal "FIFA World Cup", m[:league_name]
    assert_equal "Brazil",  m.dig(:home, :name)
    assert_equal 2,         m.dig(:home, :score)
    assert_equal "Germany", m.dig(:away, :name)
    assert_equal 1,         m.dig(:away, :score)
  end

  test "normalize_fixture returns nil for unknown status" do
    raw = {
      "fixture" => { "id" => 1, "date" => "2026-01-01", "status" => { "short" => "UNKNOWN", "elapsed" => nil }, "venue" => {} },
      "league"  => { "id" => 1, "name" => "Test", "country" => "X", "round" => nil, "logo" => nil, "flag" => nil },
      "teams"   => {
        "home" => { "id" => 1, "name" => "A", "logo" => nil, "winner" => nil },
        "away" => { "id" => 2, "name" => "B", "logo" => nil, "winner" => nil }
      },
      "goals"   => { "home" => nil, "away" => nil },
      "score"   => {}
    }
    assert_nil @client.send(:normalize_fixture, raw)
  end
end
