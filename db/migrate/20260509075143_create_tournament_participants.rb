class CreateTournamentParticipants < ActiveRecord::Migration[8.1]
  def change
    create_table :tournament_participants do |t|
      t.references :user, null: false, foreign_key: true
      t.references :tournament, null: false, foreign_key: true
      t.datetime :joined_at, null: false
      t.timestamps
    end
    add_index :tournament_participants, [:user_id, :tournament_id], unique: true
  end
end
