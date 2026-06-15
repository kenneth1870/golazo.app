class Prediction < ApplicationRecord
  validates :match_external_id, presence: true, uniqueness: true

  private

  # Largest-remainder method: floors all three, then awards the remaining
  # integer points to whichever buckets have the largest fractional parts,
  # guaranteeing the three values always sum to exactly 100 (or 0).
  def percentages(total)
    return [0, 0, 0] if total.zero?
    counts = [home_votes, draw_votes, away_votes]
    raw    = counts.map { |c| c * 100.0 / total }
    floors = raw.map(&:floor)
    rem    = 100 - floors.sum
    fracs  = raw.each_with_index.sort_by { |v, _| -(v - v.floor) }
    fracs.first(rem).each { |_, i| floors[i] += 1 }
    floors
  end

  public

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
    home_pct, draw_pct, away_pct = percentages(total)
    {
      match_external_id: match_external_id,
      home_votes: home_votes,
      draw_votes: draw_votes,
      away_votes: away_votes,
      total:      total,
      home_pct:   home_pct,
      draw_pct:   draw_pct,
      away_pct:   away_pct
    }
  end
end
