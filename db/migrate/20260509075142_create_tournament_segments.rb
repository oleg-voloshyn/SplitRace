class CreateTournamentSegments < ActiveRecord::Migration[8.1]
  def change
    create_table :tournament_segments do |t|
      t.references :tournament, null: false, foreign_key: true
      t.references :segment, null: false, foreign_key: true
      t.integer :order_number, null: false, default: 1
      t.boolean :is_rated, default: true, null: false
      t.timestamps
    end
    add_index :tournament_segments, [:tournament_id, :segment_id], unique: true
  end
end
