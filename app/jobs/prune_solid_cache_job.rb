class PruneSolidCacheJob < ApplicationJob
  queue_as :default

  CACHE_MAX_AGE  = 14.days
  CABLE_MAX_AGE  = 2.hours

  def perform
    prune_cache_entries
    prune_cable_messages
  end

  private

  def prune_cache_entries
    cutoff  = CACHE_MAX_AGE.ago
    deleted = 0
    loop do
      batch = SolidCache::Entry
                .where("created_at < ?", cutoff)
                .limit(2000)
                .delete_all
      deleted += batch
      break if batch < 2000
    end
    Rails.logger.info("[PruneSolidCacheJob] Deleted #{deleted} stale cache entries")
  end

  def prune_cable_messages
    cutoff  = CABLE_MAX_AGE.ago
    deleted = SolidCable::Message.where("created_at < ?", cutoff).delete_all
    Rails.logger.info("[PruneSolidCacheJob] Deleted #{deleted} stale cable messages")
  rescue => e
    Rails.logger.warn("[PruneSolidCacheJob] Cable prune failed: #{e.message}")
  end
end
