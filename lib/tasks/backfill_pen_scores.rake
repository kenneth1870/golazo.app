namespace :matches do
  desc "Backfill home_pen_score/away_pen_score for finished WC matches via API"
  task backfill_pen_scores: :environment do
    client = LiveScoresClient.new
    wc     = Competition.find_by!(code: "WC")

    candidates = Match.where(competition: wc, status: "finished")
                      .where(home_pen_score: nil)
                      .where.not(external_id: nil)

    puts "Backfilling #{candidates.count} matches..."
    updated = 0

    candidates.find_each do |match|
      detail = client.match_detail(match.external_id)
      next unless detail

      fx         = detail[:fixture]
      home_pen   = fx.dig("score", "penalty", "home")
      away_pen   = fx.dig("score", "penalty", "away")

      next if home_pen.nil? || away_pen.nil?

      match.update_columns(home_pen_score: home_pen, away_pen_score: away_pen)
      puts "  #{match.home_team&.name} #{match.home_score}(#{home_pen}) - #{match.away_score}(#{away_pen}) #{match.away_team&.name}"
      updated += 1
      sleep 0.25
    end

    puts "Done. Updated #{updated} matches."
  end
end
