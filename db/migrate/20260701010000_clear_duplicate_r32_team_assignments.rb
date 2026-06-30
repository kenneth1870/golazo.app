class ClearDuplicateR32TeamAssignments < ActiveRecord::Migration[8.1]
  def up
    return unless Rails.env.production?

    competition = Competition.find_by!(code: "WC")

    # Any team that has a finished R32 match cannot legitimately also appear
    # in a second *scheduled* R32 match — clear the conflicting side so
    # resolve_knockout_from_api can fill it with the correct opponent.
    updated = 0
    Match.where(competition: competition)
         .where.not(round: [ nil, "" ])
         .where.not(status: "finished")
         .find_each do |slot|
      %i[home_team_id away_team_id].each do |col|
        team_id = slot.public_send(col)
        next unless team_id

        already_played = Match.where(competition: competition,
                                      round: slot.round,
                                      status: "finished")
                               .where.not(id: slot.id)
                               .where("home_team_id = ? OR away_team_id = ?", team_id, team_id)
                               .exists?
        next unless already_played

        name = Team.find_by(id: team_id)&.name
        Rails.logger.info("[Fix] Clearing #{name} from #{slot.round} pos=#{slot.bracket_pos} — already finished this round")
        slot.update_columns(col => nil, status: "scheduled", external_id: nil,
                            home_score: nil, away_score: nil)
        slot.reload
        updated += 1
      end
    end

    Rails.logger.info("[Fix] Cleared #{updated} duplicate team assignment(s)")

    # Re-resolve now-empty slots from the API (with the guard already baked
    # into resolve_knockout_from_api by the world_cup_sync.rb code change).
    begin
      WorldCupSync.new(competition_code: "WC").resolve_knockout_from_api
    rescue => e
      Rails.logger.info("[Fix] resolve_knockout_from_api: #{e.message}")
    end

    Rails.logger.info("[Fix] Done")
  end

  def down; end
end
