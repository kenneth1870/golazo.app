require "test_helper"

class LiveScoresClientTest < ActiveSupport::TestCase
  setup do
    @prev_key = ENV["RAPIDAPI_KEY"]
    ENV["RAPIDAPI_KEY"] = "test-key" # constructor requires a key; no network is hit below
    @client = LiveScoresClient.new
  end

  teardown { ENV["RAPIDAPI_KEY"] = @prev_key }

  test "status codes map to coarse statuses" do
    assert_equal "finished", LiveScoresClient::STATUS_MAP[6]
    assert_equal "live",     LiveScoresClient::STATUS_MAP[2]
    assert_equal "scheduled", LiveScoresClient::STATUS_MAP[1]
    assert_equal "postponed", LiveScoresClient::STATUS_MAP[9]
  end

  test "normalize_match builds the common shape with team-logo URLs" do
    raw = {
      "id" => 123, "leagueId" => 4,
      "status" => { "code" => 6 },
      "startTimestamp" => 1_781_000_000,
      "home" => { "id" => 10, "name" => "Brazil", "score" => 2 },
      "away" => { "id" => 20, "name" => "Spain",  "score" => 1 }
    }

    m = @client.send(:normalize_match, raw, {})

    assert_equal 123, m[:external_id]
    assert_equal "finished", m[:status]
    assert_equal "FT", m[:status_short]
    assert_equal "Brazil", m.dig(:home, :name)
    assert_includes m.dig(:home, :logo), "10_large.png"
    assert_equal 2, m.dig(:home, :score)
  end

  test "normalize_match drops matches with an unknown status code" do
    raw = { "id" => 1, "status" => { "code" => 999 }, "home" => {}, "away" => {} }
    assert_nil @client.send(:normalize_match, raw, {})
  end

  test "featured_league? keeps internationals and drops women's / excluded leagues" do
    intl = { league_id: 4, league_country: "INT", league_name: "FIFA World Cup", home: { name: "Brazil" }, away: { name: "Spain" } }
    assert @client.send(:featured_league?, intl, {})

    womens = intl.merge(league_name: "Women's World Cup")
    refute @client.send(:featured_league?, womens, {})

    excluded = { league_id: 925953, league_country: "INT", league_name: "Women's Friendlies", home: {}, away: {} }
    refute @client.send(:featured_league?, excluded, {})

    obscure = { league_id: 99999, league_country: "FOO", league_name: "Third Division", home: {}, away: {} }
    refute @client.send(:featured_league?, obscure, {})
  end
end
