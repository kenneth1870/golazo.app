require "test_helper"

class WorldCupSyncTest < ActiveSupport::TestCase
  include ActiveJob::TestHelper
  setup do
    @old_adapter = ActiveJob::Base.queue_adapter
    ActiveJob::Base.queue_adapter = :test
    ENV["APISPORTS_KEY"] = "test-key"
    @wc  = wc_competition
    @sync = WorldCupSync.new(competition_code: "WC")
    @home = team("KOH", group: "A", name: "Knockout Home")
    @away = team("KOA", group: "B", name: "Knockout Away")
    @match = Match.create!(
      home_team: @home, away_team: @away, competition: @wc,
      round: "Round of 32", bracket_pos: 5, group_stage: nil,
      status: "live", kickoff_at: 2.hours.ago,
      home_score: 1, away_score: 1
    )
  end

  teardown do
    ActiveJob::Base.queue_adapter = @old_adapter
    ENV.delete("APISPORTS_KEY")
  end

  test "live-sync finish does not stamp group_stage on knockout matches" do
    raw = live_finish_raw(home_pen: 4, away_pen: 3)
    assert @sync.send(:sync_match_from_live, raw)

    @match.reload
    assert_equal "finished", @match.status
    assert_nil @match.group_stage, "knockout matches must keep group_stage nil"
    assert_equal 4, @match.home_pen_score
    assert_equal 3, @match.away_pen_score
  end

  test "live-sync finish persists zero penalty scores" do
    raw = live_finish_raw(home_pen: 0, away_pen: 3)
    assert @sync.send(:sync_match_from_live, raw)

    @match.reload
    assert_equal 0, @match.home_pen_score
    assert_equal 3, @match.away_pen_score
  end

  test "live-sync finish broadcasts to live_scores channel" do
    broadcasts = []
    original = ActionCable.server.method(:broadcast)
    ActionCable.server.define_singleton_method(:broadcast) do |channel, payload|
      broadcasts << [ channel, payload ] if channel == "live_scores"
      original.call(channel, payload)
    end
    begin
      assert @sync.send(:sync_match_from_live, live_finish_raw)
    ensure
      ActionCable.server.define_singleton_method(:broadcast, original)
    end

    ft = broadcasts.find { |_, p| p[:status] == "finished" }
    assert ft, "expected a finished live_scores broadcast"
    assert_equal @match.id, ft[1][:match_id]
    assert_equal 2, ft[1][:home_score]
    assert_equal 1, ft[1][:away_score]
  end

  test "live-sync finish enqueues ResolveKnockoutSlotsJob for knockout matches" do
    assert_enqueued_jobs 1, only: ResolveKnockoutSlotsJob do
      @sync.send(:sync_match_from_live, live_finish_raw)
    end
  end

  private

  def live_finish_raw(home_pen: nil, away_pen: nil)
    {
      home: { name: @home.name, score: 2, pen_score: home_pen },
      away: { name: @away.name, score: 1, pen_score: away_pen },
      minute: 120, status_short: "PEN",
      external_id: @match.external_id, kickoff_at: @match.kickoff_at.iso8601
    }
  end
end
