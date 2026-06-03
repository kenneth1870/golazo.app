class Match < ApplicationRecord
  belongs_to :home_team, class_name: "Team"
  belongs_to :away_team, class_name: "Team"
  has_many :goals, dependent: :destroy
  has_many :match_stats, dependent: :destroy

  validates :status, inclusion: { in: %w[scheduled live finished] }
  validates :home_score, :away_score, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true

  scope :live, -> { where(status: "live") }
  scope :today, -> { where(kickoff_at: Time.current.beginning_of_day..Time.current.end_of_day) }
  scope :upcoming, -> { where(status: "scheduled").order(:kickoff_at) }

  def as_json(options = {})
    super(options.merge(
      include: {
        home_team: { only: %i[id name code flag_url] },
        away_team: { only: %i[id name code flag_url] },
        goals: { only: %i[id player_name minute goal_type team_id] },
        match_stats: {}
      }
    ))
  end
end
