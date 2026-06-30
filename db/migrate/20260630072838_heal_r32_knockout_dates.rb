class HealR32KnockoutDates < ActiveRecord::Migration[8.1]
  def up
    return unless Rails.env.production?

    sync = WorldCupSync.new(competition_code: "WC")
    # Correct team pairings and kickoff times for R32/R16 knockout slots
    # that were pre-seeded with midnight-UTC placeholders and wrong opponents.
    (1..10).each do |i|
      sync.force_sync_dates([ Date.today + i ])
    end
  end

  def down; end
end
