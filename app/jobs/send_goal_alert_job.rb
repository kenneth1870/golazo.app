require "web-push"

class SendGoalAlertJob < ApplicationJob
  queue_as :default

  # Fired whenever a score changes during a live match.
  # Sends a push notification to all subscribers following either team.
  def perform(match_id:, home_name:, away_name:, home_score:, away_score:, match_url: nil)
    title = "⚽ #{home_name} #{home_score}–#{away_score} #{away_name}"
    body  = "LIVE · Goal scored!"
    url   = match_url || "/"

    subs = PushSubscription.for_teams([ home_name, away_name ])
    return if subs.empty?

    Rails.logger.info("[PushNotification] Sending goal alert to #{subs.size} subscribers")

    subs.each do |sub|
      payload = {
        title: title,
        body:  body,
        url:   url,
        icon:  "/images/apple-touch-icon.png?v=2",
        badge: "/images/badge-72.png"
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
        ttl: 300  # deliver within 5 minutes or drop
      )
    rescue WebPush::ExpiredSubscription, WebPush::InvalidSubscription => e
      Rails.logger.info("[PushNotification] Removing stale subscription #{sub.id}: #{e.message}")
      sub.destroy
    rescue => e
      Rails.logger.error("[PushNotification] Error for sub #{sub.id}: #{e.message}")
    end
  end
end
