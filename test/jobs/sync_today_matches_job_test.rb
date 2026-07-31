require "test_helper"

class SyncTodayMatchesJobTest < ActiveSupport::TestCase
  test "clubs mode busts today and yesterday caches" do
    with_focus("clubs") do
      memory_cache = ActiveSupport::Cache::MemoryStore.new
      original_cache = Rails.cache
      Rails.cache = memory_cache
      begin
        Rails.cache.write("today_api_v2_#{Date.today.iso8601}_America/Costa_Rica", [ 1 ])
        Rails.cache.write("live_scores_date_v15_#{(Date.today - 1).iso8601}_america_costa_rica", [ 2 ])

        SyncTodayMatchesJob.perform_now

        assert_nil Rails.cache.read("today_api_v2_#{Date.today.iso8601}_America/Costa_Rica")
        assert_nil Rails.cache.read("live_scores_date_v15_#{(Date.today - 1).iso8601}_america_costa_rica")
      ensure
        Rails.cache = original_cache
      end
    end
  end

  test "both mode busts club caches without skipping wc sync path" do
    with_focus("both") do
      memory_cache = ActiveSupport::Cache::MemoryStore.new
      original_cache = Rails.cache
      Rails.cache = memory_cache
      original_sync = WorldCupSync.method(:new)
      WorldCupSync.define_singleton_method(:new) do
        Class.new do
          define_method(:sync_today) { }
          define_method(:force_sync_dates) { |_dates| }
        end.new
      end
      begin
        Rails.cache.write("today_api_v2_#{Date.today.iso8601}_America/Costa_Rica", [ 1 ])

        SyncTodayMatchesJob.perform_now

        assert_nil Rails.cache.read("today_api_v2_#{Date.today.iso8601}_America/Costa_Rica")
      ensure
        WorldCupSync.define_singleton_method(:new, original_sync)
        Rails.cache = original_cache
      end
    end
  end

  private

  def with_focus(value)
    original = ENV["APP_FOCUS"]
    ENV["APP_FOCUS"] = value
    reload_focus!
    yield
  ensure
    if original.nil?
      ENV.delete("APP_FOCUS")
    else
      ENV["APP_FOCUS"] = original
    end
    reload_focus!
  end

  def reload_focus!
    AppFocus.send(:remove_const, :FOCUS)
    AppFocus.const_set(:FOCUS, ENV.fetch("APP_FOCUS", "clubs").freeze)
  end
end
