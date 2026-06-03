class Standing < ApplicationRecord
  belongs_to :team
  belongs_to :competition, optional: true

  scope :for_competition, ->(code) { joins(:competition).where(competitions: { code: code }) }
  scope :by_group, ->(g) { where(group_name: g).order(:rank) }
end
