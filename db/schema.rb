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

ActiveRecord::Schema[8.1].define(version: 2026_06_02_235426) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

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
    t.integer "away_score"
    t.bigint "away_team_id", null: false
    t.datetime "created_at", null: false
    t.string "group_stage"
    t.integer "home_score"
    t.bigint "home_team_id", null: false
    t.datetime "kickoff_at"
    t.string "round"
    t.string "status"
    t.datetime "updated_at", null: false
    t.string "venue"
    t.index ["away_team_id"], name: "index_matches_on_away_team_id"
    t.index ["home_team_id"], name: "index_matches_on_home_team_id"
  end

  create_table "teams", force: :cascade do |t|
    t.string "code"
    t.string "confederation"
    t.datetime "created_at", null: false
    t.string "flag_url"
    t.string "group"
    t.string "name"
    t.datetime "updated_at", null: false
  end

  add_foreign_key "goals", "matches"
  add_foreign_key "goals", "teams"
  add_foreign_key "match_stats", "matches"
  add_foreign_key "match_stats", "teams"
  add_foreign_key "matches", "teams", column: "away_team_id"
  add_foreign_key "matches", "teams", column: "home_team_id"
end
