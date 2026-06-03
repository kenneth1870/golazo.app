class Goal < ApplicationRecord
  belongs_to :match
  belongs_to :team

  validates :player_name, presence: true
  validates :minute, numericality: { only_integer: true, greater_than: 0, less_than_or_equal_to: 120 }
  validates :goal_type, inclusion: { in: %w[regular own_goal penalty] }

  after_create_commit :broadcast_goal

  private

  def broadcast_goal
    ActionCable.server.broadcast("match_#{match_id}", {
      type: "goal",
      goal: as_json,
      home_score: match.home_score,
      away_score: match.away_score
    })
  end
end
