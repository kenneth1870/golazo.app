class ScorePrediction < ApplicationRecord
  validates :device_id, :match_external_id, :home_guess, :away_guess, presence: true
  validates :device_id, uniqueness: { scope: :match_external_id, message: "already predicted this match" }
  validates :home_guess, :away_guess, numericality: { greater_than_or_equal_to: 0, less_than: 30 }

  # Grade a prediction after match finishes.
  # 3 pts = exact score, 1 pt = correct result (W/D/L), 0 = wrong
  def self.grade!(match_external_id:, home_score:, away_score:)
    where(match_external_id: match_external_id, points_earned: nil).find_each do |sp|
      pts = if sp.home_guess == home_score && sp.away_guess == away_score
        3
      elsif result(sp.home_guess, sp.away_guess) == result(home_score, away_score)
        1
      else
        0
      end
      sp.update_column(:points_earned, pts)
    end
  end

  # Leaderboard: sum points per device, ordered desc
  def self.leaderboard(limit: 50)
    select("device_id, display_name, SUM(points_earned) AS total_points, COUNT(*) AS predictions_made")
      .where.not(points_earned: nil)
      .group(:device_id, :display_name)
      .order("total_points DESC")
      .limit(limit)
  end

  private

  def self.result(h, a)
    return :home if h > a
    return :away if h < a
    :draw
  end
end
