class Standing < ApplicationRecord
  belongs_to :team

  scope :by_group, ->(g) { where(group_name: g).order(:rank) }
end
