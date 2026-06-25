class MatchEventNotificationJob < ApplicationJob
  queue_as :critical

  # Orchestrator only: resolves subscribers + localized copy, then fans delivery
  # out to DeliverPushJob. The actual WebPush sends (and per-sub error handling)
  # live there.

  EVENT_EMOJIS = {
    "goal"      => "⚽",
    "kickoff"   => "🏁",
    "halftime"  => "⏸",
    "fulltime"  => "✅",
    "red_card"  => "🟥",
    "prematch"  => "⏰"
  }.freeze

  # Subscribers per delivery job. Small enough that batches run in parallel
  # across workers; large enough to avoid per-job overhead dominating.
  BATCH_SIZE = 100

  def perform(event_type:, match_id:, home_name:, away_name:, home_score: nil, away_score: nil, match_url: nil, minute: nil, scorer: nil)
    event_type = event_type.to_s

    if ENV["VAPID_PUBLIC_KEY"].blank? || ENV["VAPID_PRIVATE_KEY"].blank?
      Rails.logger.error("[PushNotification] VAPID keys not configured — skipping #{event_type} notification")
      return
    end

    # Guard for full-time: re-check DB status at the moment of sending so the
    # push only goes out when the match is actually finished. The external API
    # sets status="finished" only after the final whistle, so trusting the DB
    # record is sufficient — no time-based gate needed.
    if event_type == "fulltime"
      match = Match.find_by(id: match_id)
      if match.nil? || match.status != "finished"
        Rails.logger.info("[PushNotification] Skipping fulltime for match #{match_id}: status=#{match&.status.inspect}")
        return
      end
    end

    # Deduplicate retried jobs — written only after all gates pass so a blocked
    # fulltime gate doesn't consume the idempotency window prematurely.
    dedup_key = "notif_sent_#{event_type}_#{match_id}_#{home_score}_#{away_score}_#{minute}"
    if Rails.cache.read(dedup_key)
      Rails.logger.info("[PushNotification] Skipping duplicate #{event_type} for match #{match_id}")
      return
    end
    Rails.cache.write(dedup_key, 1, expires_in: 10.minutes)

    score_str  = "#{home_score}–#{away_score}" if home_score && away_score
    url        = match_url || "/"

    subs = PushSubscription.for_teams([ home_name, away_name ])
    Rails.logger.info("[PushNotification] #{event_type} | #{home_name} vs #{away_name} | #{subs.size} subscribers found")
    return if subs.empty?

    # Copy + team names are localised per subscriber; memoise per locale so we
    # build it once. Spanish is the default for subscribers with no explicit
    # locale (the app's primary audience).
    scorer = if event_type == "goal"
      # Use scorer passed directly (from live feed events or match detail controller).
      # Fall back to DB goals table only — skip the extra live-API round-trip so the
      # notification goes out immediately rather than waiting 1-2s for a fetch.
      scorer.presence ||
        Goal.where(match_id: match_id).order(created_at: :desc).first&.player_name.presence
    end

    # Build the localized payload once per locale (copy is identical for every
    # subscriber in a locale — the random goal phrasing is sampled once here),
    # then fan out delivery into batched DeliverPushJobs so the blocking WebPush
    # sends parallelize across workers instead of running serially in this job.
    subs.group_by { |sub| %w[es en].include?(sub.locale) ? sub.locale : "es" }.each do |locale, locale_subs|
      home_t = TeamNameTranslator.translate(home_name, locale)
      away_t = TeamNameTranslator.translate(away_name, locale)
      title, body = build_copy(locale, event_type, home_t, away_t, score_str, minute, scorer)

      payload = {
        title:    title,
        body:     body,
        url:      url,
        icon:     "/images/apple-touch-icon.png?v=2",
        badge:    "/images/badge-72.png",
        match_id: match_id
      }.to_json

      locale_subs.each_slice(BATCH_SIZE) do |batch|
        DeliverPushJob.perform_later(subscription_ids: batch.map(&:id), payload: payload)
      end
    end

    Rails.logger.info("[PushNotification] Enqueued #{event_type} delivery for #{subs.size} subscribers")
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
      min_tag = minute ? " #{minute}'" : ""
      body = if scorer && minute
        [
          "¡GOLAZO de #{scorer} al #{minute}'! 🔥",
          "#{scorer} la manda al fondo en el #{minute}' 💥",
          "¡#{scorer} marca en el #{minute}'! ⚽",
          "GOL de #{scorer} · #{minute}' · ¡QUÉ GOLAZO! 🎯",
          "#{minute}' · ¡Que golazo de #{scorer}! 😱",
          "¡Ahí está! #{scorer} anota al #{minute}' 🔥",
          "#{scorer} no perdona en el #{minute}'! ⚡",
          "#{minute}' — #{scorer} con todo 💥"
        ].sample
      elsif scorer
        [
          "¡GOLAZO de #{scorer}! 🔥",
          "#{scorer} anota · EN VIVO ⚽",
          "¡#{scorer} la manda adentro! 💥",
          "GOL de #{scorer}#{min_tag} · ¡EN VIVO! 🎯"
        ].sample
      elsif minute
        [
          "¡GOL al #{minute}'! · EN VIVO 🔥",
          "¡Gol en el #{minute}'! ⚽ EN VIVO",
          "#{minute}' · ¡GOOOL! 😱",
          "¡Se armó! Gol al #{minute}' 💥",
          "#{minute}' — ¡Gol en el partido! 🔥"
        ].sample
      else
        [
          "¡GOL! · EN VIVO ⚽",
          "¡Goool! 🔥 EN VIVO",
          "¡Se abrió el marcador! ⚽",
          "¡Llegó el gol! 💥"
        ].sample
      end
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
        "¡Deja lo que estás haciendo, esto es más importante! 😄",
        "¡Silencio en la cancha! Partido en unos minutos.",
        "¿Quién crees que gana? Pronto lo sabremos 👀",
        "¡Los jugadores ya están en el túnel!",
        "Momento de concentración. ¡Arranca el partido!",
        "¡La pelota está por rodar! No te lo pierdas.",
        "Dale, que ya están saliendo al campo ⚡"
      ]
      [ "⏰ #{home} vs #{away}", bodies.sample ]
    else
      [ "#{home} vs #{away}", "" ]
    end
  end

  def build_copy_en(event_type, home, away, score, minute, scorer = nil)
    case event_type
    when "goal"
      min_tag = minute ? " #{minute}'" : ""
      body = if scorer && minute
        [
          "GOAL! #{scorer} in the #{minute}' 🔥",
          "#{scorer} finds the net — #{minute}' ⚽",
          "What a goal from #{scorer}! #{minute}' 💥",
          "#{scorer} puts it away · #{minute}' 🎯",
          "#{minute}' · #{scorer} scores! 😱",
          "#{scorer} doesn't miss — #{minute}' ⚡",
          "#{minute}' — #{scorer} with the finish! 🔥",
          "Golazo! #{scorer} · #{minute}' 💥"
        ].sample
      elsif scorer
        [
          "GOAL from #{scorer}! 🔥",
          "#{scorer} scores#{min_tag} · LIVE ⚽",
          "#{scorer} puts it in the net! 💥",
          "Golazo! #{scorer}#{min_tag} 🎯"
        ].sample
      elsif minute
        [
          "GOAL in the #{minute}'! · LIVE 🔥",
          "It's in! #{minute}' · LIVE ⚽",
          "#{minute}' — GOAL! 😱",
          "Net bulges at #{minute}'! 💥",
          "#{minute}' · They've scored! 🔥"
        ].sample
      else
        [
          "GOAL! · LIVE ⚽",
          "They've scored! 🔥 LIVE",
          "It's in the net! ⚽",
          "GOOOAL! 💥"
        ].sample
      end
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
        "Drop what you're doing — this is more important 😄",
        "The tunnel walk is happening. Time to watch!",
        "Who do you think wins this one? Find out soon 👀",
        "Players are on the pitch. It's nearly time!",
        "Clear your schedule — football is on.",
        "The referee's about to blow the whistle. You in?",
        "This is the one. Don't miss kick-off ⚽",
        "Grab a seat — it's almost showtime!"
      ]
      [ "⏰ #{home} vs #{away}", bodies.sample ]
    else
      [ "#{home} vs #{away}", "" ]
    end
  end
end
