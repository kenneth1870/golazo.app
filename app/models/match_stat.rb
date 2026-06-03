class MatchStat < ApplicationRecord
  belongs_to :match
  belongs_to :team

  after_save_commit :broadcast_stats

  private

  def broadcast_stats
    ActionCable.server.broadcast("match_#{match_id}", {
      type: "stats_update",
      stats: match.match_stats.as_json(include: :team)
    })
  end
end
