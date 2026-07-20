# Builds /leagues/:code/teams/:slug URLs for the sitemap from cached standings.
class SitemapClubTeams
  def self.urls
    return [] unless AppFocus.wc_paused?

    Rails.cache.fetch("sitemap_club_team_urls_v2", expires_in: 6.hours, race_condition_ttl: 30.seconds) do
      new.build
    end
  end

  def build
    urls = []
    AppFocus::FEATURED_CLUB_CODES.each do |code|
      flat = standings_rows(code)
      flat.each do |row|
        name = row.dig(:team, :name) || row.dig("team", "name")
        next if name.blank?

        slug = TeamDisplayNames.slug_for(name)
        urls << "/leagues/#{code}/teams/#{slug}"
      end
    end
    urls.uniq.sort
  end

  private

  def standings_rows(code)
    data = Rails.cache.read("standings_#{code}")
    if data.blank?
      ClubStandingsCache.warm!(code)
      data = Rails.cache.read("standings_#{code}")
    end
    return data if data.is_a?(Array)
    return data.values.flatten if data.is_a?(Hash)

    []
  end
end
