require "test_helper"

class PageMetaTest < ActiveSupport::TestCase
  test "root path uses the site default" do
    assert_equal PageMeta::SITE, PageMeta.for("/").title
    assert_equal "website", PageMeta.for("/").type
  end

  test "section paths get a specific, prefixed title" do
    assert_match(/Knockout Bracket/, PageMeta.for("/scores/knockout").title)
    assert_match(/Top Scorers/, PageMeta.for("/mundial/scorers").title)
  end

  test "most specific prefix wins over the general one" do
    assert_match(/Live Matches/, PageMeta.for("/scores/live").title)
    assert_match(/Scores & Fixtures/, PageMeta.for("/scores").title)
  end

  test "match by external_id resolves to article with team names" do
    wc    = wc_competition
    home  = team("PMH")
    away  = team("PMW")
    match = Match.create!(
      home_team: home, away_team: away,
      competition: wc, status: "finished",
      kickoff_at: Time.current,
      external_id: 9_999_001,
      home_score: 2, away_score: 1
    )
    meta = PageMeta.for("/matches/#{match.external_id}")
    assert_equal "article", meta.type
    assert_match home.name, meta.title
    assert_match away.name, meta.title
    assert_match "2", meta.title
  end

  test "match by db-prefixed id resolves to article" do
    wc    = wc_competition
    match = Match.create!(
      home_team: team("PMA"), away_team: team("PMB"),
      competition: wc, status: "scheduled", kickoff_at: Time.current
    )
    assert_equal "article", PageMeta.for("/matches/db-#{match.id}").type
  end

  test "news detail pages are article type" do
    assert_equal "article", PageMeta.for("/news/abc").type
  end

  test "venue slug resolves to venue-specific meta" do
    meta = PageMeta.for("/mundial/venues/metlife-stadium")
    assert_match "MetLife Stadium", meta.title
    assert_equal "website", meta.type
  end

  test "venue city-appended slug resolves correctly" do
    meta = PageMeta.for("/mundial/venues/lumen-field-seattle")
    assert_match "Lumen Field", meta.title
  end

  test "unknown venue slug falls back to default" do
    assert_equal PageMeta::SITE, PageMeta.for("/mundial/venues/nonexistent-stadium").title
  end

  test "prefix matching does not bleed across unrelated paths" do
    # "/news" must not match "/newsletter"
    assert_equal PageMeta::SITE, PageMeta.for("/newsletter").title
  end
end
