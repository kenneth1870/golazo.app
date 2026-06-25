class SitemapController < ApplicationController
  # Serves /sitemap.xml — crawlable by Google, Bing etc.
  # Includes all static sections + dynamic match/team pages.
  def index
    expires_in 6.hours, public: true

    @base = "#{request.scheme}://#{request.host_with_port}"

    # Static pages
    @static_urls = %w[
      /
      /world-cup-2026
      /scores/today
      /scores/live
      /scores/results
      /scores/fixtures
      /scores/groups
      /scores/knockout
      /mundial/teams
      /mundial/schedule
      /mundial/venues
      /mundial/scorers
      /groups
      /leaderboard
      /predictor
      /news
      /leagues
    ]

    # League detail pages — Competition model
    @league_codes = Competition.where.not(code: [ nil, "" ]).pluck(:code)

    # Dynamic match pages — only finished or upcoming within 30 days
    @matches = Match.includes(:home_team, :away_team)
                    .where(kickoff_at: 60.days.ago..30.days.from_now)
                    .where.not(home_team_id: nil, away_team_id: nil)
                    .select(:id, :external_id, :kickoff_at, :status, :home_team_id, :away_team_id, :updated_at)
                    .order(:kickoff_at)
                    .limit(500)

    # All teams
    @teams = Team.select(:id, :name, :updated_at).order(:name)

    # Recent news articles — IDs are SHA1 digests of the article link,
    # generated at parse time by NewsService. Re-use the feed cache.
    @news_articles = Rails.cache.fetch("sitemap_news_v1", expires_in: 1.hour, race_condition_ttl: 30.seconds) do
      NewsService.new.latest(limit: 200) rescue []
    end

    respond_to do |format|
      format.xml { render layout: false }
    end
  end
end
