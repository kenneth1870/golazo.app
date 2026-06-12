require "web-push"

class MatchEventNotificationJob < ApplicationJob
  queue_as :default

  EVENT_EMOJIS = {
    "goal"      => "⚽",
    "kickoff"   => "🏁",
    "halftime"  => "⏸",
    "fulltime"  => "✅",
    "red_card"  => "🟥",
  }.freeze

  def perform(event_type:, match_id:, home_name:, away_name:, home_score: nil, away_score: nil, match_url: nil, minute: nil)
    event_type = event_type.to_s
    score_str  = "#{home_score}–#{away_score}" if home_score && away_score
    url        = match_url || "/"

    title, body = build_copy(event_type, home_name, away_name, score_str, minute)

    subs = PushSubscription.for_teams([ home_name, away_name ])
    return if subs.empty?

    Rails.logger.info("[PushNotification] #{event_type} → #{subs.size} subscribers (#{home_name} vs #{away_name})")

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
        ttl: 300
      )
    rescue WebPush::ExpiredSubscription, WebPush::InvalidSubscription => e
      Rails.logger.info("[PushNotification] Removing stale subscription #{sub.id}: #{e.message}")
      sub.destroy
    rescue => e
      Rails.logger.error("[PushNotification] Error for sub #{sub.id}: #{e.message}")
    end
  end

  private

  def build_copy(event_type, home, away, score, minute)
    case event_type
    when "goal"
      [ "⚽ #{home} #{score} #{away}", "LIVE · Goal scored!" ]
    when "kickoff"
      min_str = minute ? " · #{minute}'" : ""
      [ "🏁 #{home} vs #{away}#{min_str}", "Kick-off — the match has started!" ]
    when "halftime"
      [ "⏸ Half-time · #{home} #{score} #{away}", "See you in 15 minutes." ]
    when "fulltime"
      [ "✅ Full-time · #{home} #{score} #{away}", "That's the final whistle!" ]
    when "red_card"
      [ "🟥 Red card! #{home} vs #{away}", minute ? "#{minute}' · Red card shown!" : "Red card shown!" ]
    else
      [ "#{home} vs #{away}", "" ]
    end
  end
end
