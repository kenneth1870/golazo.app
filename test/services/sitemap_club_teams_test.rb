require "test_helper"

class SitemapClubTeamsTest < ActiveSupport::TestCase
  test "builds club profile paths from standings cache" do
    original_cache = Rails.cache
    Rails.cache = ActiveSupport::Cache.lookup_store(:memory_store)

    AppFocus::FEATURED_CLUB_CODES.each do |code|
      next if code == "CRC"
      Rails.cache.write("standings_#{code}", { "Overall" => [] })
    end
    Rails.cache.write("standings_CRC", {
      "Overall" => [
        { team: { name: "Saprissa" }, rank: 1 },
        { team: { name: "Escorpiones" }, rank: 2 }
      ]
    })

    urls = SitemapClubTeams.new.build
    assert_includes urls, "/leagues/CRC/teams/saprissa"
    assert_includes urls, "/leagues/CRC/teams/escorpiones"
  ensure
    Rails.cache = original_cache if defined?(original_cache)
  end

  test "returns empty outside clubs mode" do
    orig = AppFocus::FOCUS
    AppFocus.send(:remove_const, :FOCUS)
    AppFocus.const_set(:FOCUS, "wc".freeze)
    assert_equal [], SitemapClubTeams.urls
  ensure
    AppFocus.send(:remove_const, :FOCUS)
    AppFocus.const_set(:FOCUS, orig)
  end
end
