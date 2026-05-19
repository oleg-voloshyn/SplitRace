class AddGpsSuspicionToActivities < ActiveRecord::Migration[8.1]
  def change
    change_table :activities, bulk: true do |t|
      t.boolean :suspicious, default: false, null: false
      t.jsonb :suspicious_reasons, default: [], null: false
      t.jsonb :gps_quality, default: {}, null: false
    end
    add_index :activities, :suspicious
  end
end
