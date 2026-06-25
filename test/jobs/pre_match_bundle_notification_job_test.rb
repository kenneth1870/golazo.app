require "test_helper"

class PreMatchBundleNotificationJobTest < ActiveJob::TestCase
  setup do
    @orig_adapter = ActiveJob::Base.queue_adapter
    ActiveJob::Base.queue_adapter = :test
    @prev_pub  = ENV["VAPID_PUBLIC_KEY"]
    @prev_priv = ENV["VAPID_PRIVATE_KEY"]
    ENV["VAPID_PUBLIC_KEY"]  = "pub"
    ENV["VAPID_PRIVATE_KEY"] = "priv"

    @matches = [
      { id: 1, home: "Curacao", away: "Ivory Coast", home_code: "CUW", away_code: "CIV", url: "/matches/1" },
      { id: 2, home: "Ecuador", away: "Germany",     home_code: "ECU", away_code: "GER", url: "/matches/2" }
    ]
  end

  teardown do
    ENV["VAPID_PUBLIC_KEY"]  = @prev_pub
    ENV["VAPID_PRIVATE_KEY"] = @prev_priv
    ActiveJob::Base.queue_adapter = @orig_adapter
  end

  def payload_for(endpoint)
    sub = PushSubscription.find_by(endpoint: endpoint)
    job = enqueued_jobs.find do |j|
      j[:job] == DeliverPushJob && j[:args].last.symbolize_keys[:subscription_ids].include?(sub.id)
    end
    JSON.parse(job[:args].last.symbolize_keys[:payload])
  end

  test "a global subscriber gets one push listing every match with flags" do
    PushSubscription.create!(endpoint: "https://push.example/g", p256dh: "k", auth: "a", locale: "es", team_ids: "[]")

    PreMatchBundleNotificationJob.perform_now(matches: @matches)

    payload = payload_for("https://push.example/g")
    assert_equal "⏰ 2 partidos están por empezar", payload["title"]
    assert_includes payload["body"], "🇨🇼"
    assert_includes payload["body"], "🇪🇨 Ecuador"
    assert_equal 2, payload["body"].split("\n").size
    assert_equal "/scores/today", payload["url"]
  end

  test "a team follower only receives the match they follow" do
    PushSubscription.create!(endpoint: "https://push.example/ecu", p256dh: "k", auth: "a", locale: "en", team_ids: %w[Ecuador].to_json)

    PreMatchBundleNotificationJob.perform_now(matches: @matches)

    payload = payload_for("https://push.example/ecu")
    assert_includes payload["title"], "Ecuador"
    refute_includes payload["title"], "Curacao"
    assert_equal "/matches/2", payload["url"]
  end

  test "does nothing without subscribers" do
    assert_no_enqueued_jobs only: DeliverPushJob do
      PreMatchBundleNotificationJob.perform_now(matches: @matches)
    end
  end
end
