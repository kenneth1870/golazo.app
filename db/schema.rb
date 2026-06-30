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

ActiveRecord::Schema[8.1].define(version: 2026_06_30_200001) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"
  enable_extension "pg_trgm"

  create_table "competitions", force: :cascade do |t|
    t.string "code"
    t.string "competition_type"
    t.string "country"
    t.datetime "created_at", null: false
    t.integer "external_id"
    t.string "logo"
    t.string "name"
    t.datetime "updated_at", null: false
    t.index ["code"], name: "index_competitions_on_code", unique: true
  end

  create_table "devices", force: :cascade do |t|
    t.datetime "blocked_at"
    t.string "city"
    t.string "country"
    t.datetime "created_at", null: false
    t.string "device_id", null: false
    t.integer "engaged_seconds", default: 0, null: false
    t.datetime "first_seen_at"
    t.string "ip_address"
    t.string "last_path"
    t.datetime "last_seen_at"
    t.string "locale", default: "es"
    t.string "region"
    t.datetime "updated_at", null: false
    t.string "user_agent"
    t.integer "visit_count", default: 0, null: false
    t.index ["blocked_at"], name: "index_devices_on_blocked_at"
    t.index ["device_id"], name: "index_devices_on_device_id", unique: true
    t.index ["last_seen_at"], name: "index_devices_on_last_seen_at"
  end

  create_table "goals", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "goal_type"
    t.bigint "match_id", null: false
    t.integer "minute"
    t.string "player_name"
    t.bigint "team_id", null: false
    t.datetime "updated_at", null: false
    t.index ["match_id"], name: "index_goals_on_match_id"
    t.index ["team_id"], name: "index_goals_on_team_id"
  end

  create_table "match_reactions", force: :cascade do |t|
    t.integer "count", default: 0, null: false
    t.datetime "created_at", null: false
    t.string "emoji", null: false
    t.string "match_id", null: false
    t.datetime "updated_at", null: false
    t.index ["match_id", "emoji"], name: "index_match_reactions_on_match_id_and_emoji", unique: true
    t.index ["match_id"], name: "index_match_reactions_on_match_id"
  end

  create_table "match_stats", force: :cascade do |t|
    t.integer "corners"
    t.datetime "created_at", null: false
    t.integer "fouls"
    t.bigint "match_id", null: false
    t.integer "offsides"
    t.integer "possession"
    t.integer "red_cards"
    t.integer "shots"
    t.integer "shots_on_target"
    t.bigint "team_id", null: false
    t.datetime "updated_at", null: false
    t.integer "yellow_cards"
    t.index ["match_id"], name: "index_match_stats_on_match_id"
    t.index ["team_id"], name: "index_match_stats_on_team_id"
  end

  create_table "matches", force: :cascade do |t|
    t.integer "away_pen_score"
    t.integer "away_score"
    t.string "away_slot"
    t.bigint "away_team_id"
    t.integer "bracket_pos"
    t.bigint "competition_id"
    t.datetime "created_at", null: false
    t.integer "external_id"
    t.string "group_stage"
    t.integer "home_pen_score"
    t.integer "home_score"
    t.string "home_slot"
    t.bigint "home_team_id"
    t.datetime "kickoff_at"
    t.datetime "lineups_notified_at"
    t.integer "minute"
    t.integer "minute_extra"
    t.string "round"
    t.string "status"
    t.datetime "updated_at", null: false
    t.string "venue"
    t.index ["away_team_id", "kickoff_at"], name: "index_matches_on_away_team_kickoff"
    t.index ["away_team_id"], name: "index_matches_on_away_team_id"
    t.index ["bracket_pos"], name: "index_matches_on_bracket_pos"
    t.index ["competition_id", "kickoff_at"], name: "index_matches_on_competition_kickoff"
    t.index ["competition_id", "status"], name: "index_matches_on_competition_id_and_status"
    t.index ["competition_id"], name: "index_matches_on_competition_id"
    t.index ["external_id"], name: "index_matches_on_external_id", unique: true
    t.index ["home_team_id", "kickoff_at"], name: "index_matches_on_home_team_kickoff"
    t.index ["home_team_id"], name: "index_matches_on_home_team_id"
    t.index ["kickoff_at"], name: "index_matches_on_kickoff_at"
    t.index ["status", "kickoff_at"], name: "index_matches_on_status_kickoff"
    t.index ["status"], name: "index_matches_on_status"
  end

  create_table "predictions", force: :cascade do |t|
    t.integer "away_votes", default: 0, null: false
    t.datetime "created_at", null: false
    t.integer "draw_votes", default: 0, null: false
    t.integer "home_votes", default: 0, null: false
    t.string "match_external_id", null: false
    t.datetime "updated_at", null: false
    t.text "voter_tokens", default: "[]", null: false
    t.index ["match_external_id"], name: "index_predictions_on_match_external_id", unique: true
  end

  create_table "push_subscriptions", force: :cascade do |t|
    t.string "auth", null: false
    t.datetime "created_at", null: false
    t.string "device_id"
    t.text "endpoint", null: false
    t.text "event_prefs", default: "[]"
    t.datetime "last_seen_at"
    t.string "locale", default: "es"
    t.string "p256dh", null: false
    t.string "team_ids", default: "[]"
    t.datetime "updated_at", null: false
    t.string "user_agent"
    t.index ["device_id"], name: "index_push_subscriptions_on_device_id"
    t.index ["endpoint"], name: "index_push_subscriptions_on_endpoint", unique: true
  end

  create_table "score_predictions", force: :cascade do |t|
    t.integer "away_guess", null: false
    t.string "away_team_name"
    t.datetime "created_at", null: false
    t.string "device_id", null: false
    t.string "display_name"
    t.integer "home_guess", null: false
    t.string "home_team_name"
    t.string "match_external_id", null: false
    t.integer "points_earned"
    t.datetime "updated_at", null: false
    t.index ["device_id", "match_external_id"], name: "index_score_predictions_on_device_id_and_match_external_id", unique: true
    t.index ["device_id"], name: "index_score_predictions_on_device_id"
    t.index ["points_earned"], name: "index_score_predictions_on_points_earned"
  end

  create_table "solid_cable_messages", force: :cascade do |t|
    t.binary "channel", null: false
    t.bigint "channel_hash", null: false
    t.datetime "created_at", null: false
    t.binary "payload", null: false
    t.index ["channel"], name: "index_solid_cable_messages_on_channel"
    t.index ["channel_hash"], name: "index_solid_cable_messages_on_channel_hash"
    t.index ["created_at"], name: "index_solid_cable_messages_on_created_at"
  end

  create_table "solid_cache_entries", force: :cascade do |t|
    t.integer "byte_size", null: false
    t.datetime "created_at", null: false
    t.binary "key", null: false
    t.bigint "key_hash", null: false
    t.binary "value", null: false
    t.index ["byte_size"], name: "index_solid_cache_entries_on_byte_size"
    t.index ["created_at"], name: "index_solid_cache_entries_on_created_at"
    t.index ["key_hash", "byte_size"], name: "index_solid_cache_entries_on_key_hash_and_byte_size"
    t.index ["key_hash"], name: "index_solid_cache_entries_on_key_hash", unique: true
  end

  create_table "solid_queue_blocked_executions", force: :cascade do |t|
    t.string "concurrency_key", null: false
    t.datetime "created_at", null: false
    t.datetime "expires_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.index ["concurrency_key", "priority", "job_id"], name: "index_solid_queue_blocked_executions_for_release"
    t.index ["expires_at", "concurrency_key"], name: "index_solid_queue_blocked_executions_for_maintenance"
    t.index ["job_id"], name: "index_solid_queue_blocked_executions_on_job_id", unique: true
  end

  create_table "solid_queue_claimed_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.bigint "process_id"
    t.index ["job_id"], name: "index_solid_queue_claimed_executions_on_job_id", unique: true
    t.index ["process_id", "job_id"], name: "index_solid_queue_claimed_executions_on_process_id_and_job_id"
  end

  create_table "solid_queue_failed_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "error"
    t.bigint "job_id", null: false
    t.index ["job_id"], name: "index_solid_queue_failed_executions_on_job_id", unique: true
  end

  create_table "solid_queue_jobs", force: :cascade do |t|
    t.string "active_job_id"
    t.text "arguments"
    t.string "class_name", null: false
    t.string "concurrency_key"
    t.datetime "created_at", null: false
    t.datetime "finished_at"
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.datetime "scheduled_at"
    t.datetime "updated_at", null: false
    t.index ["active_job_id"], name: "index_solid_queue_jobs_on_active_job_id"
    t.index ["class_name"], name: "index_solid_queue_jobs_on_class_name"
    t.index ["finished_at"], name: "index_solid_queue_jobs_on_finished_at"
    t.index ["queue_name", "finished_at"], name: "index_solid_queue_jobs_for_filtering"
    t.index ["scheduled_at", "finished_at"], name: "index_solid_queue_jobs_for_alerting"
  end

  create_table "solid_queue_pauses", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "queue_name", null: false
    t.index ["queue_name"], name: "index_solid_queue_pauses_on_queue_name", unique: true
  end

  create_table "solid_queue_processes", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "hostname"
    t.string "kind", null: false
    t.datetime "last_heartbeat_at", null: false
    t.text "metadata"
    t.string "name", null: false
    t.integer "pid", null: false
    t.bigint "supervisor_id"
    t.index ["last_heartbeat_at"], name: "index_solid_queue_processes_on_last_heartbeat_at"
    t.index ["name", "supervisor_id"], name: "index_solid_queue_processes_on_name_and_supervisor_id", unique: true
    t.index ["supervisor_id"], name: "index_solid_queue_processes_on_supervisor_id"
  end

  create_table "solid_queue_ready_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.index ["job_id"], name: "index_solid_queue_ready_executions_on_job_id", unique: true
    t.index ["priority", "job_id"], name: "index_solid_queue_poll_all"
    t.index ["queue_name", "priority", "job_id"], name: "index_solid_queue_poll_by_queue"
  end

  create_table "solid_queue_recurring_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.datetime "run_at", null: false
    t.string "task_key", null: false
    t.index ["job_id"], name: "index_solid_queue_recurring_executions_on_job_id", unique: true
    t.index ["task_key", "run_at"], name: "index_solid_queue_recurring_executions_on_task_key_and_run_at", unique: true
  end

  create_table "solid_queue_recurring_tasks", force: :cascade do |t|
    t.text "arguments"
    t.string "class_name"
    t.string "command", limit: 2048
    t.datetime "created_at", null: false
    t.text "description"
    t.string "key", null: false
    t.integer "priority", default: 0
    t.string "queue_name"
    t.string "schedule", null: false
    t.boolean "static", default: true, null: false
    t.datetime "updated_at", null: false
    t.index ["key"], name: "index_solid_queue_recurring_tasks_on_key", unique: true
    t.index ["static"], name: "index_solid_queue_recurring_tasks_on_static"
  end

  create_table "solid_queue_scheduled_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.datetime "scheduled_at", null: false
    t.index ["job_id"], name: "index_solid_queue_scheduled_executions_on_job_id", unique: true
    t.index ["scheduled_at", "priority", "job_id"], name: "index_solid_queue_dispatch_all"
  end

  create_table "solid_queue_semaphores", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "expires_at", null: false
    t.string "key", null: false
    t.datetime "updated_at", null: false
    t.integer "value", default: 1, null: false
    t.index ["expires_at"], name: "index_solid_queue_semaphores_on_expires_at"
    t.index ["key", "value"], name: "index_solid_queue_semaphores_on_key_and_value"
    t.index ["key"], name: "index_solid_queue_semaphores_on_key", unique: true
  end

  create_table "standings", force: :cascade do |t|
    t.bigint "competition_id"
    t.datetime "created_at", null: false
    t.integer "drawn"
    t.integer "goals_against"
    t.integer "goals_for"
    t.string "group_name"
    t.integer "lost"
    t.integer "played"
    t.integer "points"
    t.integer "rank"
    t.bigint "team_id", null: false
    t.datetime "updated_at", null: false
    t.integer "won"
    t.index ["competition_id", "team_id"], name: "index_standings_on_competition_id_and_team_id", unique: true
    t.index ["competition_id"], name: "index_standings_on_competition_id"
    t.index ["team_id"], name: "index_standings_on_team_id"
  end

  create_table "teams", force: :cascade do |t|
    t.string "code"
    t.string "confederation"
    t.datetime "created_at", null: false
    t.integer "external_id"
    t.string "flag_url"
    t.string "group"
    t.string "name"
    t.datetime "updated_at", null: false
    t.index ["code"], name: "index_teams_on_code"
    t.index ["code"], name: "index_teams_on_code_trgm", opclass: :gin_trgm_ops, using: :gin
    t.index ["external_id"], name: "index_teams_on_external_id", unique: true
    t.index ["name"], name: "index_teams_on_name_trgm", opclass: :gin_trgm_ops, using: :gin
  end

  create_table "users", force: :cascade do |t|
    t.datetime "blocked_at"
    t.datetime "created_at", null: false
    t.string "email"
    t.datetime "last_sign_in_at"
    t.string "name"
    t.string "password_digest"
    t.integer "role"
    t.integer "sign_in_count", default: 0, null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  add_foreign_key "goals", "matches"
  add_foreign_key "goals", "teams"
  add_foreign_key "match_stats", "matches"
  add_foreign_key "match_stats", "teams"
  add_foreign_key "matches", "competitions"
  add_foreign_key "matches", "teams", column: "away_team_id"
  add_foreign_key "matches", "teams", column: "home_team_id"
  add_foreign_key "solid_queue_blocked_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_claimed_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_failed_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_ready_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_recurring_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_scheduled_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "standings", "competitions"
  add_foreign_key "standings", "teams"
end
