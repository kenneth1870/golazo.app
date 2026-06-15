class MatchStat < ApplicationRecord
  belongs_to :match
  belongs_to :team

  validates :possession, numericality: { greater_than_or_equal_to: 0, less_than_or_equal_to: 100 }, allow_nil: true
  validates :shots_on_target, :shots_total, :fouls, :yellow_cards, :red_cards, :corners,
            numericality: { greater_than_or_equal_to: 0, only_integer: true }, allow_nil: true

  after_save_commit :broadcast_stats

  private

  def broadcast_stats
    ActionCable.server.broadcast("match_#{match_id}", {
      type: "stats_update",
      stats: match.match_stats.includes(:team).as_json(include: :team)
    })
  end
end
