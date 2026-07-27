class WarmNewsContentJob < ApplicationJob
  queue_as :default

  def perform
    %w[es en].each do |lang|
      NewsService.new.warm_content_cache!(lang: lang, limit: 8)
    end
  end
end
