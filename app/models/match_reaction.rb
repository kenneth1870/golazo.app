class MatchReaction < ApplicationRecord
  ALLOWED = %w[⚽ 🔥 😭 🎉 😮 👏].freeze

  validates :match_id, presence: true
  validates :emoji,    presence: true, inclusion: { in: ALLOWED }
  validates :count,    numericality: { greater_than_or_equal_to: 0 }

  # Atomically increment a reaction count. Creates the row if it doesn't exist.
  def self.react!(match_id, emoji)
    return false unless ALLOWED.include?(emoji)

    upsert(
      { match_id: match_id, emoji: emoji, count: 1,
        created_at: Time.current, updated_at: Time.current },
      on_duplicate: Arel.sql("count = match_reactions.count + 1, updated_at = NOW()"),
      unique_by: [:match_id, :emoji]
    )
    true
  rescue => e
    Rails.logger.error("[MatchReaction] react! failed: #{e.message}")
    false
  end

  # Returns { "⚽" => 12, "🔥" => 5, ... } for a match
  def self.counts_for(match_id)
    where(match_id: match_id)
      .pluck(:emoji, :count)
      .to_h
  end
end
