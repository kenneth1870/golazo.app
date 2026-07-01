require "web-push"

# Delivers an already-rendered, localized push payload to a batch of
# subscriptions. Fanned out from MatchEventNotificationJob so the (blocking)
# WebPush HTTPS sends run in parallel across SolidQueue workers instead of
# serially in one job — keeping goal/full-time alerts timely even when there
# are thousands of subscribers.
#
# Per-subscription error handling (stale-sub cleanup, consecutive-failure
# pruning) lives here, moved verbatim from the old inline loop.
class DeliverPushJob < ApplicationJob
  queue_as :critical

  # Inline rescues below stop these from propagating; the class-level guard is a
  # safety net for any unexpected escape.
  discard_on WebPush::ExpiredSubscription, WebPush::InvalidSubscription

  # @param subscription_ids [Array<Integer>] PushSubscription ids to deliver to
  # @param payload [String] fully-rendered, localized JSON payload
  def perform(subscription_ids:, payload:)
    return if ENV["VAPID_PUBLIC_KEY"].blank? || ENV["VAPID_PRIVATE_KEY"].blank?

    vapid = {
      subject:     ENV.fetch("VAPID_SUBJECT", "mailto:admin@golazo.app"),
      public_key:  ENV["VAPID_PUBLIC_KEY"],
      private_key: ENV["VAPID_PRIVATE_KEY"]
    }

    PushSubscription.where(id: subscription_ids).find_each do |sub|
      WebPush.payload_send(
        message:  payload,
        endpoint: sub.endpoint,
        p256dh:   sub.p256dh,
        auth:     sub.auth,
        vapid:    vapid,
        ttl:      300
      )
    rescue WebPush::ExpiredSubscription, WebPush::InvalidSubscription => e
      Rails.logger.info("[DeliverPush] Removing stale subscription #{sub.id}: #{e.message}")
      sub.destroy
    rescue WebPush::ResponseError => e
      Rails.logger.warn("[DeliverPush] ResponseError for sub #{sub.id}: #{e.message}")
      fail_key = "push_fail_#{sub.id}"
      count    = (Rails.cache.read(fail_key) || 0) + 1
      if count >= 5
        Rails.logger.info("[DeliverPush] Removing subscription #{sub.id} after #{count} consecutive failures")
        sub.destroy
      else
        Rails.cache.write(fail_key, count, expires_in: 7.days)
      end
    rescue => e
      Rails.logger.error("[DeliverPush] Unexpected error for sub #{sub.id}: #{e.class}: #{e.message}")
    end
  end
end
