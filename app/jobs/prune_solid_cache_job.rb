class PruneSolidCacheJob < ApplicationJob
  queue_as :default

  MAX_AGE = 60.days

  def perform
    cutoff  = MAX_AGE.ago
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
end
