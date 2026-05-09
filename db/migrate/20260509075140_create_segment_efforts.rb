class CreateSegmentEfforts < ActiveRecord::Migration[8.1]
  def change
    create_table :segment_efforts do |t|
      t.references :user, null: false, foreign_key: true
      t.references :segment, null: false, foreign_key: true
      t.references :activity, null: false, foreign_key: true
      t.integer :elapsed_time_seconds, null: false
      t.datetime :started_at, null: false
      t.float :pace_per_km
      t.timestamps
    end
    add_index :segment_efforts, [:user_id, :segment_id, :elapsed_time_seconds]
  end
end
