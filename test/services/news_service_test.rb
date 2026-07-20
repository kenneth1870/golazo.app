require "test_helper"

class NewsServiceTest < ActiveSupport::TestCase
  test "rank_for_leagues boosts matching articles" do
    articles = [
      { title: "Premier League roundup", summary: "Arsenal win" },
      { title: "Saprissa beat Herediano", summary: "Liga Tica clash in Costa Rica" },
      { title: "Generic football news", summary: "Transfers around Europe" }
    ]

    ranked = NewsService.new.rank_for_leagues(articles, [ "CRC" ])
    assert_match(/Saprissa|Costa Rica/i, ranked.first[:title])
  end

  test "normalize_league_codes keeps featured codes only" do
    service = NewsService.new
    codes = service.send(:normalize_league_codes, [ "CRC", "LMX", "WC", "nope" ])
    assert_equal %w[CRC LMX], codes
  end

  test "league espn urls include costa rica" do
    assert NewsService::LEAGUE_ESPN_URLS.key?("CRC")
    assert_match(/crc\.1/, NewsService::LEAGUE_ESPN_URLS["CRC"])
  end
end
