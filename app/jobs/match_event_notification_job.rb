require "web-push"

class MatchEventNotificationJob < ApplicationJob
  queue_as :default

  # Subscription errors are handled inline (per-sub rescue) so the job never
  # raises them — discard_on is a safety net for unexpected propagation only.
  discard_on WebPush::ExpiredSubscription, WebPush::InvalidSubscription

  EVENT_EMOJIS = {
    "goal"      => "⚽",
    "kickoff"   => "🏁",
    "halftime"  => "⏸",
    "fulltime"  => "✅",
    "red_card"  => "🟥",
    "prematch"  => "⏰"
  }.freeze

  def perform(event_type:, match_id:, home_name:, away_name:, home_score: nil, away_score: nil, match_url: nil, minute: nil)
    event_type = event_type.to_s

    # Final delivery-time gate for full-time. Re-check the LIVE DB state at the
    # moment of sending, so a "match ended" push can never go out while the game
    # is still on — regardless of how the job was enqueued (premature trigger,
    # stale/retried job from an earlier outage, or any upstream bug). The match
    # must actually be 'finished' in the DB and have run long enough to plausibly
    # be over (≥100 min since kickoff: 45 + half-time + 45 + stoppage; extra time
    # is later still).
    if event_type == "fulltime"
      match = Match.find_by(id: match_id)
      if match.nil? || match.status != "finished" ||
          (match.kickoff_at.present? && match.kickoff_at > 100.minutes.ago)
        Rails.logger.info("[PushNotification] Skipping fulltime for match #{match_id}: status=#{match&.status.inspect} kickoff=#{match&.kickoff_at}")
        return
      end
    end

    score_str  = "#{home_score}–#{away_score}" if home_score && away_score
    url        = match_url || "/"

    subs = PushSubscription.for_teams([ home_name, away_name ])
    Rails.logger.info("[PushNotification] #{event_type} | #{home_name} vs #{away_name} | #{subs.size} subscribers found")
    return if subs.empty?

    # Copy + team names are localised per subscriber; memoise per locale so we
    # build it once. Spanish is the default for subscribers with no explicit
    # locale (the app's primary audience).
    scorer = if event_type == "goal"
      Goal.where(match_id: match_id).order(created_at: :desc).first&.player_name.presence
    end

    copy_cache = {}

    subs.each do |sub|
      locale      = %w[es en].include?(sub.locale) ? sub.locale : "es"
      title, body = copy_cache[locale] ||= begin
        home_t = TeamNameTranslator.translate(home_name, locale)
        away_t = TeamNameTranslator.translate(away_name, locale)
        build_copy(locale, event_type, home_t, away_t, score_str, minute, scorer)
      end

      payload = {
        title:    title,
        body:     body,
        url:      url,
        icon:     "/images/apple-touch-icon.png?v=2",
        badge:    "/images/badge-72.png",
        match_id: match_id
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
      Rails.logger.info("[PushNotification] Sent #{event_type} to sub #{sub.id} (#{sub.push_provider})")
    rescue WebPush::ExpiredSubscription, WebPush::InvalidSubscription => e
      Rails.logger.info("[PushNotification] Removing stale subscription #{sub.id}: #{e.message}")
      sub.destroy
    rescue WebPush::ResponseError => e
      Rails.logger.warn("[PushNotification] ResponseError for sub #{sub.id}: #{e.message}")
      fail_key = "push_fail_#{sub.id}"
      count    = (Rails.cache.read(fail_key) || 0) + 1
      if count >= 5
        Rails.logger.info("[PushNotification] Removing subscription #{sub.id} after #{count} consecutive failures")
        sub.destroy
      else
        Rails.cache.write(fail_key, count, expires_in: 7.days)
      end
    rescue => e
      Rails.logger.error("[PushNotification] Unexpected error for sub #{sub.id}: #{e.class}: #{e.message}")
    end
  end

  private

  def build_copy(locale, event_type, home, away, score, minute, scorer = nil)
    locale == "en" ? build_copy_en(event_type, home, away, score, minute, scorer)
                   : build_copy_es(event_type, home, away, score, minute, scorer)
  end

  # Spanish copy — the app's default audience.
  def build_copy_es(event_type, home, away, score, minute, scorer = nil)
    case event_type
    when "goal"
      body = scorer ? "¡GOL de #{scorer}! · EN VIVO" : "¡GOL! · EN VIVO"
      [ "⚽ #{home} #{score} #{away}", body ]
    when "kickoff"
      min_str = minute ? " · #{minute}'" : ""
      [ "🏁 #{home} vs #{away}#{min_str}", "¡Comenzó el partido!" ]
    when "halftime"
      [ "⏸ Medio tiempo · #{home} #{score} #{away}", "Nos vemos en 15 minutos." ]
    when "fulltime"
      [ "✅ Final · #{home} #{score} #{away}", "¡Final del partido!" ]
    when "red_card"
      [ "🟥 ¡Tarjeta roja! #{home} vs #{away}", minute ? "#{minute}' · ¡Tarjeta roja!" : "¡Tarjeta roja mostrada!" ]
    when "prematch"
      bodies = [
        "¡Ya falta poco! ¿Estás listo?",
        "¡Calentando motores! El partido arranca pronto ⚡",
        "¡Ponte cómodo, que ya empieza! 👀",
        "¡Que no te agarre desprevenido! Arranca en nada.",
        "¡Hora de ponerse el uniforme! ⚽",
        "¿Ya tienes los snacks listos? Empieza pronto.",
        "¡El momento se acerca! ¿Listo para el partido?",
        "¡Atención! El partido está por comenzar.",
      ]
      [ "⏰ #{home} vs #{away}", bodies.sample ]
    else
      [ "#{home} vs #{away}", "" ]
    end
  end

  def build_copy_en(event_type, home, away, score, minute, scorer = nil)
    case event_type
    when "goal"
      body = scorer ? "#{scorer} · LIVE" : "LIVE · Goal scored!"
      [ "⚽ #{home} #{score} #{away}", body ]
    when "kickoff"
      min_str = minute ? " · #{minute}'" : ""
      [ "🏁 #{home} vs #{away}#{min_str}", "Kick-off — the match has started!" ]
    when "halftime"
      [ "⏸ Half-time · #{home} #{score} #{away}", "See you in 15 minutes." ]
    when "fulltime"
      [ "✅ Full-time · #{home} #{score} #{away}", "That's the final whistle!" ]
    when "red_card"
      [ "🟥 Red card! #{home} vs #{away}", minute ? "#{minute}' · Red card shown!" : "Red card shown!" ]
    when "prematch"
      bodies = [
        "Almost time — are you ready? ⚡",
        "Get your game face on! Kick-off is near.",
        "Warming up! The match is about to start.",
        "Don't miss it — kick-off is almost here!",
        "Got your snacks ready? It starts soon 👀",
        "Time to focus — the match is nearly on!",
        "Settle in, it's almost kick-off time! ⚽",
        "The wait is almost over. Let's go!",
      ]
      [ "⏰ #{home} vs #{away}", bodies.sample ]
    else
      [ "#{home} vs #{away}", "" ]
    end
  end
end
