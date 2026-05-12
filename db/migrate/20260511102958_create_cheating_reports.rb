class CreateCheatingReports < ActiveRecord::Migration[8.1]
  def change
    create_table :cheating_reports do |t|
      t.references :reporter,      null: false, foreign_key: { to_table: :users }
      t.references :reported_user, null: false, foreign_key: { to_table: :users }
      t.references :tournament,    null: false, foreign_key: true
      t.text       :reason,        null: false
      t.string     :status,        null: false, default: "pending"
      t.text       :admin_notes
      t.datetime   :reviewed_at
      t.references :reviewed_by,   foreign_key: { to_table: :users }
      t.timestamps
    end

    add_index :cheating_reports,
              [:reporter_id, :reported_user_id, :tournament_id],
              unique: true,
              name:   "idx_cheating_reports_uniq"
    add_index :cheating_reports, :status
  end
end
