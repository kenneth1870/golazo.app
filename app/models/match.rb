class Match < ApplicationRecord
  # Optional: knockout fixtures exist before their teams are known (TBD slots).
  belongs_to :home_team, class_name: "Team", optional: true
  belongs_to :away_team, class_name: "Team", optional: true
  belongs_to :competition, optional: true
  has_many :goals, dependent: :destroy
  has_many :match_stats, dependent: :destroy

  # "postponed" covers PST / CANC / ABD codes from the API (see LiveScoresClient::STATUS_MAP).
  validates :status, inclusion: { in: %w[scheduled live finished postponed] }
  validates :home_score, :away_score, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true

  scope :live,     -> { where(status: "live") }
  scope :today,    -> { where(kickoff_at: Time.current.beginning_of_day..Time.current.end_of_day) }
  scope :upcoming, -> { where(status: "scheduled").order(:kickoff_at) }
  scope :by_competition, ->(code) { joins(:competition).where(competitions: { code: code }) }
  scope :by_group, ->(g) { where(group_stage: g) }
  scope :group_stage, -> { where.not(group_stage: nil) }
  scope :knockout,    -> { where(group_stage: nil) }

  def knockout? = group_stage.blank?
  def teams_decided? = home_team_id.present? && away_team_id.present?

  def as_json(options = {})
    super(options.merge(
      include: {
        home_team:   { only: %i[id name code flag_url] },
        away_team:   { only: %i[id name code flag_url] },
        goals:       { only: %i[id player_name minute goal_type team_id] },
        match_stats: {},
        competition: { only: %i[id name code logo country] }
      }
    )).merge(
      "home_slot" => home_slot,
      "away_slot" => away_slot,
      "bracket_pos" => bracket_pos
    )
  end
end
