# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_05_11_102958) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"
  enable_extension "postgis"

  create_table "activities", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.float "distance_meters"
    t.integer "elapsed_time_seconds"
    t.datetime "finished_at"
    t.jsonb "gps_points", default: []
    t.geography "gps_track", limit: {srid: 4326, type: "line_string", geographic: true}
    t.string "source", default: "web_pwa", null: false
    t.datetime "started_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["user_id", "started_at"], name: "index_activities_on_user_id_and_started_at"
    t.index ["user_id"], name: "index_activities_on_user_id"
  end

  create_table "cheating_reports", force: :cascade do |t|
    t.text "admin_notes"
    t.datetime "created_at", null: false
    t.text "reason", null: false
    t.bigint "reported_user_id", null: false
    t.bigint "reporter_id", null: false
    t.datetime "reviewed_at"
    t.bigint "reviewed_by_id"
    t.string "status", default: "pending", null: false
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.index ["reported_user_id"], name: "index_cheating_reports_on_reported_user_id"
    t.index ["reporter_id", "reported_user_id", "tournament_id"], name: "idx_cheating_reports_uniq", unique: true
    t.index ["reporter_id"], name: "index_cheating_reports_on_reporter_id"
    t.index ["reviewed_by_id"], name: "index_cheating_reports_on_reviewed_by_id"
    t.index ["status"], name: "index_cheating_reports_on_status"
    t.index ["tournament_id"], name: "index_cheating_reports_on_tournament_id"
  end

  create_table "oauth_identities", force: :cascade do |t|
    t.string "access_token"
    t.datetime "created_at", null: false
    t.string "provider", null: false
    t.string "refresh_token"
    t.datetime "token_expires_at"
    t.string "uid", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["provider", "uid"], name: "index_oauth_identities_on_provider_and_uid", unique: true
    t.index ["user_id", "provider"], name: "index_oauth_identities_on_user_id_and_provider", unique: true
    t.index ["user_id"], name: "index_oauth_identities_on_user_id"
  end

  create_table "segment_efforts", force: :cascade do |t|
    t.bigint "activity_id", null: false
    t.datetime "created_at", null: false
    t.integer "elapsed_time_seconds", null: false
    t.float "pace_per_km"
    t.bigint "segment_id", null: false
    t.datetime "started_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["activity_id"], name: "index_segment_efforts_on_activity_id"
    t.index ["segment_id"], name: "index_segment_efforts_on_segment_id"
    t.index ["user_id", "segment_id", "elapsed_time_seconds"], name: "idx_on_user_id_segment_id_elapsed_time_seconds_ddc59ad97a"
    t.index ["user_id"], name: "index_segment_efforts_on_user_id"
  end

  create_table "segments", force: :cascade do |t|
    t.string "city"
    t.string "country"
    t.datetime "created_at", null: false
    t.bigint "created_by_id", null: false
    t.text "description"
    t.float "distance_meters"
    t.float "elevation_gain", default: 0.0
    t.geography "end_point", limit: {srid: 4326, type: "st_point", geographic: true}
    t.boolean "is_active", default: true, null: false
    t.string "name", null: false
    t.geography "polyline", limit: {srid: 4326, type: "multi_line_string", geographic: true}
    t.geography "start_point", limit: {srid: 4326, type: "st_point", geographic: true}
    t.datetime "updated_at", null: false
    t.index ["created_by_id"], name: "index_segments_on_created_by_id"
    t.index ["is_active"], name: "index_segments_on_is_active"
  end

  create_table "tournament_participants", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "joined_at", null: false
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["tournament_id"], name: "index_tournament_participants_on_tournament_id"
    t.index ["user_id", "tournament_id"], name: "index_tournament_participants_on_user_id_and_tournament_id", unique: true
    t.index ["user_id"], name: "index_tournament_participants_on_user_id"
  end

  create_table "tournament_scores", force: :cascade do |t|
    t.integer "completed_segments_count", default: 0, null: false
    t.datetime "created_at", null: false
    t.integer "gender_rank"
    t.integer "rank"
    t.float "score", default: 0.0
    t.integer "total_time_seconds"
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.bigint "user_id", null: false
    t.index ["tournament_id", "score"], name: "index_tournament_scores_on_tournament_id_and_score"
    t.index ["tournament_id"], name: "index_tournament_scores_on_tournament_id"
    t.index ["user_id", "tournament_id"], name: "index_tournament_scores_on_user_id_and_tournament_id", unique: true
    t.index ["user_id"], name: "index_tournament_scores_on_user_id"
  end

  create_table "tournament_segments", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.boolean "is_rated", default: true, null: false
    t.integer "order_number", default: 1, null: false
    t.bigint "segment_id", null: false
    t.bigint "tournament_id", null: false
    t.datetime "updated_at", null: false
    t.index ["segment_id"], name: "index_tournament_segments_on_segment_id"
    t.index ["tournament_id", "segment_id"], name: "index_tournament_segments_on_tournament_id_and_segment_id", unique: true
    t.index ["tournament_id"], name: "index_tournament_segments_on_tournament_id"
  end

  create_table "tournaments", force: :cascade do |t|
    t.string "city"
    t.string "country"
    t.datetime "created_at", null: false
    t.bigint "created_by_id", null: false
    t.text "description"
    t.datetime "ends_at"
    t.integer "max_participants"
    t.string "name", null: false
    t.integer "rated_segments_count", default: 1, null: false
    t.string "scoring_type", default: "golden_fever", null: false
    t.string "slug", null: false
    t.datetime "starts_at"
    t.string "status", default: "draft", null: false
    t.integer "total_segments_count", default: 1, null: false
    t.datetime "updated_at", null: false
    t.index ["created_by_id"], name: "index_tournaments_on_created_by_id"
    t.index ["slug"], name: "index_tournaments_on_slug", unique: true
    t.index ["status"], name: "index_tournaments_on_status"
  end

  create_table "users", force: :cascade do |t|
    t.string "avatar_url"
    t.string "city"
    t.string "country"
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.string "first_name"
    t.string "gender", default: "other"
    t.string "last_name"
    t.string "locale", default: "en", null: false
    t.string "password_digest"
    t.string "role", default: "user", null: false
    t.string "units", default: "km", null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  add_foreign_key "activities", "users"
  add_foreign_key "cheating_reports", "tournaments"
  add_foreign_key "cheating_reports", "users", column: "reported_user_id"
  add_foreign_key "cheating_reports", "users", column: "reporter_id"
  add_foreign_key "cheating_reports", "users", column: "reviewed_by_id"
  add_foreign_key "oauth_identities", "users"
  add_foreign_key "segment_efforts", "activities"
  add_foreign_key "segment_efforts", "segments"
  add_foreign_key "segment_efforts", "users"
  add_foreign_key "segments", "users", column: "created_by_id"
  add_foreign_key "tournament_participants", "tournaments"
  add_foreign_key "tournament_participants", "users"
  add_foreign_key "tournament_scores", "tournaments"
  add_foreign_key "tournament_scores", "users"
  add_foreign_key "tournament_segments", "segments"
  add_foreign_key "tournament_segments", "tournaments"
  add_foreign_key "tournaments", "users", column: "created_by_id"
end
