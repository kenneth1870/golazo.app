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

  test "match and news detail pages are article type" do
    assert_equal "article", PageMeta.for("/matches/123").type
    assert_equal "article", PageMeta.for("/news/abc").type
  end

  test "prefix matching does not bleed across unrelated paths" do
    # "/news" must not match "/newsletter"
    assert_equal PageMeta::SITE, PageMeta.for("/newsletter").title
  end
end
