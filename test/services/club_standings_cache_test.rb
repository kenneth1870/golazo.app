require "test_helper"

class ClubStandingsCacheTest < ActiveSupport::TestCase
  test "warm writes flattened standings to cache" do
    rows = [
      {
        "rank" => 1,
        "group" => "Overall",
        "team" => { "name" => "Deportivo Saprissa", "logo" => "https://example.com/s.png" },
        "all" => { "played" => 10, "win" => 7, "draw" => 2, "lose" => 1, "goals" => { "for" => 20, "against" => 8 } },
        "goalsDiff" => 12,
        "points" => 23
      }
    ]

    fake_client = Class.new do
      define_method(:league_standings_for_code) { |_code| rows }
    end

    with_fake_live_client(fake_client) do
      memory_cache = ActiveSupport::Cache::MemoryStore.new
      original_cache = Rails.cache
      Rails.cache = memory_cache
      begin
        ClubStandingsCache.warm!("CRC")
        cached = Rails.cache.read("standings_CRC")
        assert cached.is_a?(Hash)
        assert_equal "Saprissa", cached["Overall"].first[:team][:name]
        assert_equal 23, cached["Overall"].first[:points]
      ensure
        Rails.cache = original_cache
      end
    end
  end

  private

  def with_fake_live_client(klass)
    original = LiveScoresClient.method(:new)
    LiveScoresClient.define_singleton_method(:new) { klass.new }
    yield
  ensure
    LiveScoresClient.define_singleton_method(:new, original)
  end
end
