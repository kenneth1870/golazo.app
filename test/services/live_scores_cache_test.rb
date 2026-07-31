require "test_helper"

class LiveScoresCacheTest < ActiveSupport::TestCase
  test "bust_date clears timezone-specific date and today API keys" do
    memory_cache = ActiveSupport::Cache::MemoryStore.new
    original_cache = Rails.cache
    Rails.cache = memory_cache
    date = Date.new(2026, 7, 30)

    Rails.cache.write("live_scores_date_v15_2026-07-30_america_costa_rica", [ 1 ])
    Rails.cache.write("today_api_v2_2026-07-30_America/Costa_Rica", [ 2 ])
    Rails.cache.write("today_league_v2_CRC_2026-07-30_America/Costa_Rica", [ 3 ])

    LiveScoresCache.bust_date!(date, timezones: [ "America/Costa_Rica" ])

    assert_nil Rails.cache.read("live_scores_date_v15_2026-07-30_america_costa_rica")
    assert_nil Rails.cache.read("today_api_v2_2026-07-30_America/Costa_Rica")
    assert_nil Rails.cache.read("today_league_v2_CRC_2026-07-30_America/Costa_Rica")
  ensure
    Rails.cache = original_cache
  end

  test "bust_kickoff clears local calendar date for kickoff timezone" do
    memory_cache = ActiveSupport::Cache::MemoryStore.new
    original_cache = Rails.cache
    Rails.cache = memory_cache

    kickoff = "2026-07-30T02:00:00Z"
    Rails.cache.write("today_api_v2_2026-07-29_America/Costa_Rica", [ 1 ])

    LiveScoresCache.bust_kickoff!(kickoff, timezones: [ "America/Costa_Rica", "UTC" ])

    assert_nil Rails.cache.read("today_api_v2_2026-07-29_America/Costa_Rica")
  ensure
    Rails.cache = original_cache
  end
end
