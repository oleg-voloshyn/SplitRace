class CreateActivities < ActiveRecord::Migration[8.1]
  def change
    create_table :activities do |t|
      t.references :user, null: false, foreign_key: true
      t.datetime :started_at, null: false
      t.datetime :finished_at
      t.line_string :gps_track, geographic: true
      t.jsonb :gps_points, default: []
      t.float :distance_meters
      t.integer :elapsed_time_seconds
      t.string :source, default: "web_pwa", null: false
      t.timestamps
    end
    add_index :activities, [:user_id, :started_at]
  end
end
