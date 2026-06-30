class AddPenaltyScoresToMatches < ActiveRecord::Migration[8.1]
  def change
    add_column :matches, :home_pen_score, :integer
    add_column :matches, :away_pen_score, :integer
  end
end
