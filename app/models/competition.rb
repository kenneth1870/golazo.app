class Competition < ApplicationRecord
  has_many :matches, dependent: :destroy
  has_many :standings

  validates :name, :code, presence: true

  scope :by_country, ->(c) { where(country: c) }

  WC = "WC"

  def world_cup? = code == WC
end
