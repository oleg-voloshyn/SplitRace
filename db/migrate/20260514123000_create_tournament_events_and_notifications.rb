class CreateTournamentEventsAndNotifications < ActiveRecord::Migration[8.1]
  def change
    create_table :tournament_events do |t|
      t.references :tournament, null: false, foreign_key: true
      t.references :actor, null: false, foreign_key: { to_table: :users }
      t.references :segment, foreign_key: true
      t.references :segment_effort, foreign_key: true
      t.string :event_type, null: false
      t.string :title, null: false
      t.text :body
      t.jsonb :metadata, null: false, default: {}

      t.timestamps
    end

    add_index :tournament_events,
              %i[tournament_id event_type segment_effort_id],
              unique: true,
              name: 'idx_tournament_events_unique_segment_effort',
              where: 'segment_effort_id IS NOT NULL'

    create_table :notifications do |t|
      t.references :user, null: false, foreign_key: true
      t.references :tournament, foreign_key: true
      t.references :tournament_event, foreign_key: true
      t.string :notification_type, null: false
      t.string :title, null: false
      t.text :body
      t.datetime :read_at

      t.timestamps
    end

    add_index :notifications, %i[user_id read_at created_at]
  end
end
