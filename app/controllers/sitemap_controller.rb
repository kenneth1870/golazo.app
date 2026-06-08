class SitemapController < ApplicationController
  # Serves /sitemap.xml — crawlable by Google, Bing etc.
  # Includes all static sections + dynamic match/team pages.
  def index
    expires_in 6.hours, public: true

    @base = "#{request.scheme}://#{request.host_with_port}"

    # Static pages
    @static_urls = %w[
      /
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
      /leaderboard
      /predictor
      /news
      /leagues
    ]

    # Dynamic match pages — only finished or upcoming within 30 days
    @matches = Match.includes(:home_team, :away_team)
                    .where(kickoff_at: 60.days.ago..30.days.from_now)
                    .where.not(home_team_id: nil, away_team_id: nil)
                    .order(:kickoff_at)
                    .limit(500)

    # All teams
    @teams = Team.all.order(:name)

    respond_to do |format|
      format.xml { render layout: false }
    end
  end
end
