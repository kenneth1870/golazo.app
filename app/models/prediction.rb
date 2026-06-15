class Prediction < ApplicationRecord
  validates :match_external_id, presence: true, uniqueness: true

  # voter_tokens is stored as a JSON hash: { token => 1, ... }
  # Old array format is migrated on first read so no DB migration is needed.
  def tokens
    raw = JSON.parse(voter_tokens)
    raw.is_a?(Hash) ? raw : raw.each_with_object({}) { |v, h| h[v] = 1 }
  rescue
    {}
  end

  def voted?(token)
    token.present? && tokens.key?(token)
  end

  def vote!(choice, token)
    return { error: "invalid_choice" } unless %w[home draw away].include?(choice)

    result = nil
    self.class.transaction do
      locked = self.class.lock("FOR UPDATE").find(id)
      if locked.voted?(token)
        result = { error: "already_voted" }
        raise ActiveRecord::Rollback
      end
      locked.increment!("#{choice}_votes")
      locked.update_column(:voter_tokens, locked.tokens.merge(token => 1).to_json) if token.present?
      result = locked.as_json_result
    end
    result
  end

  def as_json_result
    total = home_votes + draw_votes + away_votes
    {
      match_external_id: match_external_id,
      home_votes:  home_votes,
      draw_votes:  draw_votes,
      away_votes:  away_votes,
      total:       total,
      home_pct:    total > 0 ? (home_votes * 100.0 / total).round : 0,
      draw_pct:    total > 0 ? (draw_votes * 100.0 / total).round : 0,
      away_pct:    total > 0 ? (away_votes * 100.0 / total).round : 0
    }
  end
end
