class CreateTournaments < ActiveRecord::Migration[8.1]
  def change
    create_table :tournaments do |t|
      t.string :name, null: false
      t.string :slug, null: false
      t.text :description
      t.string :status, default: "draft", null: false
      t.string :scoring_type, default: "fastest_total", null: false
      t.datetime :starts_at
      t.datetime :ends_at
      t.integer :total_segments_count, null: false, default: 1
      t.integer :rated_segments_count, null: false, default: 1
      t.integer :max_participants
      t.string :city
      t.string :country
      t.references :created_by, null: false, foreign_key: { to_table: :users }
      t.timestamps
    end
    add_index :tournaments, :slug, unique: true
    add_index :tournaments, :status
  end
end
