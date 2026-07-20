class AddLigaTicaCompetition < ActiveRecord::Migration[8.0]
  def up
    Competition.find_or_create_by!(code: "CRC") do |c|
      c.name             = "Liga Tica"
      c.competition_type = "league"
      c.country          = "Costa Rica"
      c.logo             = "https://media.api-sports.io/football/leagues/162.png"
      c.external_id      = 162
    end
  end

  def down
    Competition.find_by(code: "CRC")&.destroy
  end
end
