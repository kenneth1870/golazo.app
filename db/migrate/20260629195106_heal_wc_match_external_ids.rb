class HealWcMatchExternalIds < ActiveRecord::Migration[8.1]
  def up
    # Re-sync all WC match dates to fix scrambled external_ids (e.g. Germany vs
    # DR Congo → Germany vs Paraguay). Runs inline so prod data is correct as
    # soon as the deploy finishes without needing a manual admin action.
    return unless Rails.env.production?

    ResyncAllWcMatchesJob.perform_now
  end

  def down; end
end
