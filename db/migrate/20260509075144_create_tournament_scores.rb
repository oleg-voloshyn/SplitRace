class CreateTournamentScores < ActiveRecord::Migration[8.1]
  def change
    create_table :tournament_scores do |t|
      t.references :user, null: false, foreign_key: true
      t.references :tournament, null: false, foreign_key: true
      t.integer :total_time_seconds
      t.integer :completed_segments_count, default: 0, null: false
      t.integer :rank
      t.integer :gender_rank
      t.float :score, default: 0.0
      t.timestamps
    end
    add_index :tournament_scores, [:user_id, :tournament_id], unique: true
    add_index :tournament_scores, [:tournament_id, :score]
  end
end
