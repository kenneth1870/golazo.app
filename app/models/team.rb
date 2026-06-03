class Team < ApplicationRecord
  has_many :home_matches, class_name: "Match", foreign_key: :home_team_id, dependent: :destroy
  has_many :away_matches, class_name: "Match", foreign_key: :away_team_id, dependent: :destroy
  has_many :goals, dependent: :destroy
  has_many :match_stats, dependent: :destroy

  validates :name, presence: true
  validates :code, presence: true, length: { is: 3 }

  def matches
    Match.where("home_team_id = ? OR away_team_id = ?", id, id)
  end
end
