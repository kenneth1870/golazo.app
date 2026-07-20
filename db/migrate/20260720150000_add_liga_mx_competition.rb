class AddLigaMxCompetition < ActiveRecord::Migration[8.0]
  def up
    Competition.find_or_create_by!(code: "LMX") do |c|
      c.name             = "Liga MX"
      c.competition_type = "league"
      c.country          = "Mexico"
      c.logo             = "https://media.api-sports.io/football/leagues/262.png"
      c.external_id      = 262
    end
  end

  def down
    Competition.find_by(code: "LMX")&.destroy
  end
end
