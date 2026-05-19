class AddGpsSuspicionToActivities < ActiveRecord::Migration[8.1]
  def change
    add_column :activities, :suspicious, :boolean, default: false, null: false
    add_column :activities, :suspicious_reasons, :jsonb, default: [], null: false
    add_column :activities, :gps_quality, :jsonb, default: {}, null: false
    add_index :activities, :suspicious
  end
end
