require "test_helper"

class MatchEventNotificationJobTest < ActiveJob::TestCase
  setup do
    @orig_adapter = ActiveJob::Base.queue_adapter
    ActiveJob::Base.queue_adapter = :test
    @wc    = wc_competition
    @home  = team("AAA", name: "Argentina")
    @away  = team("BBB", name: "Brazil")
    @match = Match.create!(
      home_team: @home, away_team: @away, competition: @wc,
      status: "finished", home_score: 2, away_score: 1, kickoff_at: 2.hours.ago
    )
    @prev_pub  = ENV["VAPID_PUBLIC_KEY"]
    @prev_priv = ENV["VAPID_PRIVATE_KEY"]
    ENV["VAPID_PUBLIC_KEY"]  = "pub"
    ENV["VAPID_PRIVATE_KEY"] = "priv"
  end

  teardown do
    ENV["VAPID_PUBLIC_KEY"]  = @prev_pub
    ENV["VAPID_PRIVATE_KEY"] = @prev_priv
    ActiveJob::Base.queue_adapter = @orig_adapter
  end

  test "fans delivery out to DeliverPushJob, one batch per locale" do
    PushSubscription.create!(endpoint: "https://push.example/1", p256dh: "k1", auth: "a1", locale: "es", team_ids: "[]")
    PushSubscription.create!(endpoint: "https://push.example/2", p256dh: "k2", auth: "a2", locale: "en", team_ids: "[]")

    assert_enqueued_jobs 2, only: DeliverPushJob do
      MatchEventNotificationJob.perform_now(
        event_type: "fulltime", match_id: @match.id,
        home_name: "Argentina", away_name: "Brazil",
        home_score: 2, away_score: 1
      )
    end
  end

  test "does nothing when there are no matching subscribers" do
    assert_no_enqueued_jobs only: DeliverPushJob do
      MatchEventNotificationJob.perform_now(
        event_type: "fulltime", match_id: @match.id,
        home_name: "Argentina", away_name: "Brazil",
        home_score: 2, away_score: 1
      )
    end
  end
end
