class SyncR32PenScores < ActiveRecord::Migration[8.1]
  def up
    return unless Rails.env.production?

    sync   = WorldCupSync.new(competition_code: "WC")
    client = sync.instance_variable_get(:@api)

    data     = client.send(:get, "fixtures", league: WorldCupSync::WC_LEAGUE_ID, season: WorldCupSync::WC_SEASON_ID)
    fixtures = data.dig("response") || []

    finished = fixtures.select do |fx|
      status = fx.dig("fixture", "status", "short")
      %w[FT AET PEN].include?(status)
    end

    updated = 0
    finished.each do |fx|
      fixture_id = fx.dig("fixture", "id")
      pen_home   = fx.dig("score", "penalty", "home")
      pen_away   = fx.dig("score", "penalty", "away")
      next unless pen_home && pen_away

      slot = Match.find_by(external_id: fixture_id, group_stage: nil)
      next unless slot
      next if slot.home_pen_score == pen_home && slot.away_pen_score == pen_away

      home_name = fx.dig("teams", "home", "name")
      away_name = fx.dig("teams", "away", "name")
      Rails.logger.info("[SyncPen] #{home_name} vs #{away_name} — pen #{pen_home}–#{pen_away}")
      slot.update_columns(home_pen_score: pen_home, away_pen_score: pen_away)
      updated += 1
    end

    Rails.logger.info("[SyncPen] Updated #{updated} knockout match(es) with penalty scores")
  end

  def down; end
end
