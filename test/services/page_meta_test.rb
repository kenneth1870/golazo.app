require "test_helper"

class PageMetaTest < ActiveSupport::TestCase
  test "club match json-ld omits FIFA organizer" do
    with_focus("clubs") do
      comp = Competition.create!(code: "CRC", name: "Primera División Costa Rica")
      home = Team.create!(name: "Deportivo Saprissa", code: "SAP")
      away = Team.create!(name: "Liga Deportiva Alajuelense", code: "LDA")
      match = Match.create!(
        competition: comp,
        home_team: home,
        away_team: away,
        external_id: 9_900_001,
        kickoff_at: Time.utc(2026, 7, 30, 2, 0),
        status: "scheduled"
      )

      meta = PageMeta.for_match(match.external_id)

      assert_includes meta.title, "Saprissa"
      assert_not meta.json_ld.key?("organizer")
    end
  end

  test "world cup match json-ld includes FIFA organizer" do
    with_focus("wc") do
      comp = Competition.create!(code: "WC", name: "FIFA World Cup 2026")
      home = Team.create!(name: "Brazil", code: "BRA")
      away = Team.create!(name: "France", code: "FRA")
      match = Match.create!(
        competition: comp,
        home_team: home,
        away_team: away,
        external_id: 9_900_002,
        kickoff_at: Time.utc(2026, 7, 15, 20, 0),
        status: "scheduled"
      )

      meta = PageMeta.for_match(match.external_id)

      assert_equal "FIFA", meta.json_ld.dig("organizer", "name")
    end
  end

  private

  def with_focus(value)
    original = ENV["APP_FOCUS"]
    ENV["APP_FOCUS"] = value
    reload_focus!
    yield
  ensure
    if original.nil?
      ENV.delete("APP_FOCUS")
    else
      ENV["APP_FOCUS"] = original
    end
    reload_focus!
  end

  def reload_focus!
    AppFocus.send(:remove_const, :FOCUS)
    AppFocus.const_set(:FOCUS, ENV.fetch("APP_FOCUS", "clubs").freeze)
  end
end
