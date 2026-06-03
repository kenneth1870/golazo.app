class AddCompetitionToMatches < ActiveRecord::Migration[8.1]
  def change
    add_reference :matches, :competition, null: true, foreign_key: true
  end
end
