class AddConcacafCompetitions < ActiveRecord::Migration[8.0]
  COMPETITIONS = [
    { code: "CAC", name: "Copa Centroamericana", country: "CONCACAF", type: "cup", logo: "https://media.api-sports.io/football/leagues/1028.png", ext: 1028 },
    { code: "CCC", name: "Concachampions",       country: "CONCACAF", type: "cup", logo: "https://media.api-sports.io/football/leagues/16.png",   ext: 16   }
  ].freeze

  def up
    COMPETITIONS.each do |l|
      Competition.find_or_create_by!(code: l[:code]) do |c|
        c.name             = l[:name]
        c.competition_type = l[:type]
        c.country          = l[:country]
        c.logo             = l[:logo]
        c.external_id      = l[:ext]
      end
    end
  end

  def down
    COMPETITIONS.each { |l| Competition.find_by(code: l[:code])&.destroy }
  end
end
