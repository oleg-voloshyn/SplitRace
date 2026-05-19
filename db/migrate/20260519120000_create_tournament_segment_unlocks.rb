class CreateTournamentSegmentUnlocks < ActiveRecord::Migration[8.1]
  def up
    create_table :tournament_segment_unlocks do |t|
      t.references :tournament, null: false, foreign_key: true
      t.references :user, null: false, foreign_key: true
      t.references :segment, null: false, foreign_key: true
      t.references :tournament_segment, null: false, foreign_key: true
      t.references :segment_effort, null: false, foreign_key: true
      t.integer :position, null: false
      t.datetime :unlocked_at, null: false

      t.timestamps
    end

    add_index :tournament_segment_unlocks,
              %i[tournament_id user_id segment_id],
              unique: true,
              name: 'idx_tournament_unlocks_unique_segment'
    add_index :tournament_segment_unlocks,
              %i[tournament_id user_id tournament_segment_id],
              unique: true,
              name: 'idx_tournament_unlocks_unique_tournament_segment'
    add_index :tournament_segment_unlocks,
              %i[tournament_id segment_id unlocked_at],
              name: 'idx_tournament_unlocks_first_opener'
    add_index :tournament_segment_unlocks,
              %i[user_id tournament_id],
              name: 'idx_tournament_unlocks_user_tournament'

    add_reference :tournament_events, :tournament_segment_unlock, foreign_key: true, index: false
    add_index :tournament_events,
              :tournament_segment_unlock_id,
              unique: true,
              where: 'tournament_segment_unlock_id IS NOT NULL',
              name: 'idx_tournament_events_unique_unlock'

    backfill_unlocks_from_events
    link_events_to_unlocks
  end

  def down
    remove_index :tournament_events, name: 'idx_tournament_events_unique_unlock'
    remove_reference :tournament_events, :tournament_segment_unlock, foreign_key: true
    drop_table :tournament_segment_unlocks
  end

  private

  def backfill_unlocks_from_events
    execute <<~SQL.squish
      INSERT INTO tournament_segment_unlocks (
        tournament_id,
        user_id,
        segment_id,
        tournament_segment_id,
        segment_effort_id,
        position,
        unlocked_at,
        created_at,
        updated_at
      )
      SELECT DISTINCT ON (
        tournament_events.tournament_id,
        tournament_events.actor_id,
        tournament_events.segment_id
      )
        tournament_events.tournament_id,
        tournament_events.actor_id,
        tournament_events.segment_id,
        tournament_segments.id,
        tournament_events.segment_effort_id,
        tournament_segments.order_number,
        segment_efforts.started_at,
        tournament_events.created_at,
        tournament_events.updated_at
      FROM tournament_events
      INNER JOIN segment_efforts
        ON segment_efforts.id = tournament_events.segment_effort_id
       AND segment_efforts.user_id = tournament_events.actor_id
       AND segment_efforts.segment_id = tournament_events.segment_id
      INNER JOIN tournament_segments
        ON tournament_segments.tournament_id = tournament_events.tournament_id
       AND tournament_segments.segment_id = tournament_events.segment_id
      INNER JOIN tournaments
        ON tournaments.id = tournament_events.tournament_id
      INNER JOIN tournament_participants
        ON tournament_participants.tournament_id = tournament_events.tournament_id
       AND tournament_participants.user_id = tournament_events.actor_id
      WHERE tournament_events.event_type = 'segment_unlocked'
        AND tournament_events.segment_effort_id IS NOT NULL
        AND tournament_events.segment_id IS NOT NULL
        AND (tournaments.starts_at IS NULL OR segment_efforts.started_at >= tournaments.starts_at)
        AND segment_efforts.started_at >= tournament_participants.joined_at
        AND (tournaments.ends_at IS NULL OR segment_efforts.started_at < tournaments.ends_at)
      ORDER BY
        tournament_events.tournament_id,
        tournament_events.actor_id,
        tournament_events.segment_id,
        segment_efforts.started_at ASC,
        tournament_events.id ASC
      ON CONFLICT (tournament_id, user_id, segment_id) DO NOTHING
    SQL
  end

  def link_events_to_unlocks
    execute <<~SQL.squish
      UPDATE tournament_events
      SET tournament_segment_unlock_id = tournament_segment_unlocks.id
      FROM tournament_segment_unlocks
      WHERE tournament_events.event_type = 'segment_unlocked'
        AND tournament_events.tournament_id = tournament_segment_unlocks.tournament_id
        AND tournament_events.actor_id = tournament_segment_unlocks.user_id
        AND tournament_events.segment_id = tournament_segment_unlocks.segment_id
        AND tournament_events.segment_effort_id = tournament_segment_unlocks.segment_effort_id
    SQL
  end
end
