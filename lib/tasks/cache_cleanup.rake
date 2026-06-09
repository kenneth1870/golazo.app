# One-time maintenance tasks for pruning stale cache key prefixes.
# Run: bin/rails cache:prune_ai_v2
namespace :cache do
  desc "Delete orphaned ai_match_summary_v2_* entries left over from the v2→v3 rename"
  task prune_ai_v2: :environment do
    if Rails.cache.respond_to?(:delete_matched)
      count = 0
      Rails.cache.delete_matched("ai_match_summary_v2_*")
      puts "Pruned ai_match_summary_v2_* cache entries."
    else
      # SolidCache stores entries in the DB — delete via SQL for efficiency
      pattern = "%ai_match_summary_v2_%"
      deleted = SolidCache::Entry.where("key LIKE ?", pattern).delete_all
      puts "Pruned #{deleted} ai_match_summary_v2_* SolidCache entries."
    end
  end
end
