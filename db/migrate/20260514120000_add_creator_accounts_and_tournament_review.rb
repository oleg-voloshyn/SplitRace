class AddCreatorAccountsAndTournamentReview < ActiveRecord::Migration[8.1]
  def change
    change_table :users, bulk: true do |t|
      t.string :account_type, null: false, default: 'user'
      t.string :club_name
    end
    add_index :users, :account_type

    change_table :tournaments, bulk: true do |t|
      t.change_default :status, from: 'draft', to: 'draft'
      t.datetime :submitted_for_review_at
      t.datetime :reviewed_at
      t.text :review_note
    end
    add_reference :tournaments, :reviewed_by, foreign_key: { to_table: :users }
  end
end
