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

  test "dedupe_articles removes duplicate titles and links" do
    items = [
      { id: "1", link: "https://a.test/1", title: "Same headline" },
      { id: "2", link: "https://a.test/2", title: "Same headline" },
      { id: "3", link: "https://a.test/1", title: "Other headline" }
    ]

    deduped = NewsService.new.send(:dedupe_articles, items)
    assert_equal 1, deduped.length
    assert_equal "1", deduped.first[:id]
    assert_equal "Same headline", deduped.first[:title]
  end
end
