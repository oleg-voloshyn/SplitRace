class CreateSegments < ActiveRecord::Migration[8.1]
  def change
    create_table :segments do |t|
      t.string :name, null: false
      t.text :description
      t.st_point :start_point, geographic: true
      t.st_point :end_point, geographic: true
      t.multi_line_string :polyline, geographic: true
      t.float :distance_meters
      t.float :elevation_gain, default: 0.0
      t.string :city
      t.string :country
      t.references :created_by, null: false, foreign_key: { to_table: :users }
      t.boolean :is_active, default: true, null: false
      t.timestamps
    end
    add_index :segments, :is_active
  end
end
