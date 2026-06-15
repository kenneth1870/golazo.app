require "web-push"

class SendLineupAlertJob < ApplicationJob
  queue_as :default

  # Fired when lineups are published for an upcoming match (~1 hour before kickoff).
  # Sends a push to all subscribers following either team.
  def perform(match_id:, home_name:, away_name:, kickoff_at: nil, match_url: nil)
    time_str = kickoff_at ? Time.parse(kickoff_at.to_s).strftime("%-H:%M") : nil
    home_es  = TeamNameTranslator.translate(home_name, "es")
    away_es  = TeamNameTranslator.translate(away_name, "es")
    title = "📋 Alineaciones publicadas"
    body  = [ home_es, "vs", away_es, time_str ? "· #{time_str}" : nil ].compact.join(" ")
    url   = match_url || "/"

    subs = PushSubscription.for_teams([ home_name, away_name ])
    return if subs.empty?

    Rails.logger.info("[LineupAlert] Sending to #{subs.size} subscribers for #{home_name} vs #{away_name}")

    subs.each do |sub|
      payload = {
        title: title,
        body:  body,
        url:   url,
        icon:  "/images/apple-touch-icon.png?v=2",
        badge: "/images/badge-72.png",
        tag:   "lineup-#{match_id}"
      }.to_json

      WebPush.payload_send(
        message:    payload,
        endpoint:   sub.endpoint,
        p256dh:     sub.p256dh,
        auth:       sub.auth,
        vapid: {
          subject:     ENV["VAPID_SUBJECT"],
          public_key:  ENV["VAPID_PUBLIC_KEY"],
          private_key: ENV["VAPID_PRIVATE_KEY"]
        },
        ttl: 3600
      )
    rescue WebPush::ExpiredSubscription, WebPush::InvalidSubscription
      sub.destroy
    rescue => e
      Rails.logger.error("[LineupAlert] sub #{sub.id}: #{e.message}")
    end
  end
end
