class PruneSolidCacheJob < ApplicationJob
  queue_as :default

  def perform
    deleted = 0
    loop do
      batch = SolidCache::Entry
                .where("expires_at IS NOT NULL AND expires_at < ?", Time.current)
                .limit(2000)
                .delete_all
      deleted += batch
      break if batch < 2000
    end
    Rails.logger.info("[PruneSolidCacheJob] Deleted #{deleted} expired cache entries")
  end
end
