class MatchEventNotificationJob < ApplicationJob
  queue_as :critical

  # Orchestrator only: resolves subscribers + localized copy, then fans delivery
  # out to DeliverPushJob. The actual WebPush sends (and per-sub error handling)
  # live there.

  EVENT_EMOJIS = {
    "goal"           => "⚽",
    "goal_disallowed" => "🚫",
    "kickoff"        => "🏁",
    "halftime"       => "⏸",
    "fulltime"       => "✅",
    "red_card"       => "🟥",
    "prematch"       => "⏰"
  }.freeze

  # Subscribers per delivery job. Small enough that batches run in parallel
  # across workers; large enough to avoid per-job overhead dominating.
  BATCH_SIZE = 100

  def perform(event_type:, match_id:, home_name:, away_name:, home_score: nil, away_score: nil, match_url: nil, minute: nil, scorer: nil, reason: nil)
    event_type = event_type.to_s

    if ENV["VAPID_PUBLIC_KEY"].blank? || ENV["VAPID_PRIVATE_KEY"].blank?
      Rails.logger.error("[PushNotification] VAPID keys not configured — skipping #{event_type} notification")
      return
    end

    # Only send notifications for events that have meaningful copy.
    # Kickoff/halftime/red_card fall through to an empty-body notification that
    # overwrites prematch/goal alerts in the device tray (same match tag).
    unless %w[goal prematch fulltime].include?(event_type)
      Rails.logger.info("[PushNotification] Skipping #{event_type} — not a notifiable event type")
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

    # Filter by per-subscriber event preferences before building localized copy.
    # Empty prefs (default) = receives all events; explicit list = opt-in subset.
    # "goal_disallowed" rides on the "goal" preference — anyone who wants goal
    # alerts wants to know when one gets overturned too.
    pref_event_type = event_type == "goal_disallowed" ? "goal" : event_type
    subs = subs.select { |sub| sub.receives_event?(pref_event_type) }
    return if subs.empty?

    # Build the localized payload once per locale (copy is identical for every
    # subscriber in a locale — the random goal phrasing is sampled once here),
    # then fan out delivery into batched DeliverPushJobs so the blocking WebPush
    # sends parallelize across workers instead of running serially in this job.
    subs.group_by { |sub| %w[es en].include?(sub.locale) ? sub.locale : "es" }.each do |locale, locale_subs|
      home_t = TeamNameTranslator.translate(home_name, locale)
      away_t = TeamNameTranslator.translate(away_name, locale)

      # Derive the "perspective team" from the first subscriber's followed teams
      # that is actually playing in this match. Falls back to nil (neutral copy).
      followed = locale_subs.first&.team_names&.find { |t|
        t.casecmp?(home_name) || t.casecmp?(away_name)
      }
      followed_t = followed ? TeamNameTranslator.translate(followed, locale) : nil

      title, body = build_copy(locale, event_type, home_t, away_t, score_str, minute, scorer, reason,
                               subscriber_team: followed_t, home_score: home_score, away_score: away_score)

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
  rescue => e
    Rails.logger.error("[PushNotification] Unexpected error for #{event_type} match #{match_id}: #{e.class}: #{e.message}")
    Rails.logger.error(e.backtrace.first(5).join("\n"))
    raise
  end

  private

  def build_copy(locale, event_type, home, away, score, minute, scorer = nil, reason = nil, subscriber_team: nil, home_score: nil, away_score: nil)
    opts = { subscriber_team: subscriber_team, home_score: home_score, away_score: away_score }
    build_copy_es(event_type, home, away, score, minute, scorer, reason, **opts)
  end

  VAR_REASONS_ES = {
    "foul"             => "Falta",
    "offside"          => "Fuera de juego",
    "handball"         => "Mano",
    "violent conduct"  => "Conducta violenta",
    "var review"       => "Revisión VAR",
    "goal disallowed"  => "Gol Anulado"
  }.freeze

  # Infers goal context from the new score so messages can react to the moment.
  # Returns :opener, :equalizer, :go_ahead, :extending, or :generic.
  # "go_ahead" = just took the lead from level (h-a==1 means team was level before this goal).
  # "extending" = already had a lead and increased it (h-a>=2).
  # True comeback narrative requires match history we don't have, so we don't label it.
  def goal_context(home_score, away_score, home_name, away_name, subscriber_team)
    return :generic unless home_score && away_score
    h = home_score.to_i
    a = away_score.to_i
    total = h + a
    return :opener if total == 1
    if h == a
      :equalizer
    elsif subscriber_team == home_name
      h > a ? (h - a == 1 ? :go_ahead : :extending) : :generic
    elsif subscriber_team == away_name
      a > h ? (a - h == 1 ? :go_ahead : :extending) : :generic
    else
      :generic
    end
  end

  # Infers fulltime result from the subscriber's perspective.
  def fulltime_result(home_score, away_score, home_name, away_name, subscriber_team)
    return :draw unless home_score && away_score
    h = home_score.to_i
    a = away_score.to_i
    return :draw if h == a
    winner = h > a ? home_name : away_name
    subscriber_team == winner ? :win : :loss
  end

  # Spanish copy — the app's default audience.
  def build_copy_es(event_type, home, away, score, minute, scorer = nil, reason = nil, subscriber_team: nil, home_score: nil, away_score: nil)
    case event_type
    when "goal"
      ctx = goal_context(home_score, away_score, home, away, subscriber_team)

      body = case ctx
      when :opener
        if scorer && minute
          [
            "¡PRIMERO EN MARCAR! #{scorer} al #{minute}' 🚀",
            "#{scorer} rompe el cero en el #{minute}' ⚽",
            "¡Arranca el marcador! #{scorer} · #{minute}' 🔥",
            "El primero es de #{scorer} · #{minute}' 💥",
            "¡ABRIÓ EL PARTIDO! #{scorer} al #{minute}' 😱"
          ].sample
        elsif minute
          [
            "¡SE ABRIÓ EL MARCADOR! · #{minute}' 🚀",
            "El primero llegó al #{minute}' ⚽",
            "¡Cero eliminado! Gol al #{minute}' 🔥"
          ].sample
        else
          [ "¡Llegó el primero! ⚽", "¡Se abrió el marcador! 🔥", "¡GOOOL de apertura! 😱" ].sample
        end
      when :equalizer
        if scorer && minute
          [
            "¡LO EMPATAN! #{scorer} al #{minute}' 😤",
            "#{scorer} pone las tablas · #{minute}' ⚖️",
            "¡Igualan! #{scorer} en el #{minute}' — esto se pone bueno 👀",
            "¡EMPATE! #{scorer} · #{minute}' · El partido vive 🔥",
            "#{minute}' · #{scorer} y a empezar de nuevo 😅"
          ].sample
        elsif minute
          [
            "¡EMPATAN AL #{minute}'! 😤",
            "¡Igualan el partido! #{minute}' ⚖️",
            "#{minute}' · ¡Todo igual! Partido abierto 🔥"
          ].sample
        else
          [ "¡EMPATE! ⚖️ Partido igualado", "¡Lo empataron! Todo vivo 🔥", "¡Tablas! El partido sigue abierto 😤" ].sample
        end
      when :go_ahead
        if scorer && minute
          [
            "¡SE VAN ARRIBA! #{scorer} al #{minute}' 🚀",
            "#{scorer} pone el partido a favor · #{minute}' 💥",
            "¡GOL DE LA VENTAJA! #{scorer} · #{minute}' 🔥",
            "#{minute}' · #{scorer} y se adelantan 😤",
            "¡Ahí está el que manda! #{scorer} al #{minute}' ⚡",
            "¡SE LO DAN VUELTA! #{scorer} al #{minute}' 🤯",
            "#{scorer} y la remontada está servida · #{minute}' 💪"
          ].sample
        else
          [ "¡SE VAN ADELANTE! 🚀", "¡Toman la delantera! 💥", "¡Gol de la ventaja! 🔥", "¡SE LO DAN VUELTA! 🤯" ].sample
        end
      when :extending
        if scorer && minute
          [
            "¡MÁS! #{scorer} al #{minute}' — esto ya es goleada 🔥",
            "#{scorer} sigue sumando · #{minute}' 💥",
            "#{minute}' · #{scorer} · ¡No paran! 😤",
            "¡Otro más de #{scorer} al #{minute}'! 🎯",
            "#{scorer} y la diferencia crece · #{minute}' 😬"
          ].sample
        else
          [ "¡AMPLÍAN LA VENTAJA! 💥", "¡Otro más! 🔥", "¡No paran de marcar! 😤" ].sample
        end
      else
        if scorer && minute
          [
            "¡GOLAZO de #{scorer} al #{minute}'! 🔥",
            "#{scorer} la manda al fondo · #{minute}' 💥",
            "¡#{scorer} marca al #{minute}'! 😱",
            "#{minute}' · ¡Que golazo de #{scorer}! 🎯",
            "#{scorer} no perdona en el #{minute}' ⚡"
          ].sample
        elsif scorer
          [ "¡GOLAZO de #{scorer}! 🔥", "¡#{scorer} la manda adentro! 💥", "GOL de #{scorer} · EN VIVO ⚽" ].sample
        elsif minute
          [ "¡GOL al #{minute}'! 🔥", "#{minute}' · ¡GOOOL! 😱", "¡Gol en el #{minute}'! ⚽" ].sample
        else
          [ "¡GOL! ⚽", "¡Goool! 🔥", "¡Llegó el gol! 💥" ].sample
        end
      end

      [ "⚽ #{home} #{score} #{away}", body ]

    when "fulltime"
      result = fulltime_result(home_score, away_score, home, away, subscriber_team)

      body = case result
      when :win
        [
          "¡GANARON! 🏆 Así se hace",
          "¡Victoria! 💪 Los 3 puntos son suyos",
          "¡Se lo merecían! ¡Ganaron! 🎉",
          "¡TRIUNFO! Qué partidazo 🔥",
          "¡Sí señor! Victoria merecida 💥",
          "¡TRES PUNTOS! Nada más que agregar 🏆",
          "¡Ganaron y bien! El equipo respondió 💪"
        ].sample
      when :loss
        [
          "No se pudo... 💔 Así es el fútbol",
          "Que amarga derrota 😔",
          "Se fue... pero hay que levantar la cabeza 💪",
          "No era el día. Hay que seguir 😞",
          "Duro golpe. La próxima será 💔",
          "Perdieron, pero el fútbol siempre vuelve 🙏",
          "Ay no... a digerir y a pensar en lo que sigue 😤"
        ].sample
      else
        [
          "Empate. Un punto es un punto 🤷",
          "¡Cómo sufrimos! Pero un punto suma 😅",
          "Tablas. El resultado lo dice todo... o nada 🤔",
          "Un punto que puede saber a mucho o a poco 👀",
          "Empate y a reflexionar 🧠",
          "Ni para unos ni para otros. Empate justo ⚖️",
          "¡Partido peleado! Se reparten los puntos 🤝"
        ].sample
      end

      [ "✅ Final · #{home} #{score} #{away}", body ]

    when "prematch"
      bodies = [
        "¡Esto es lo que esperábamos! Arranca en minutos ⚽",
        "¿Ya estás listo? El partido no espera 👀",
        "¡A los puestos! Que ya sale la pelota 🚀",
        "¡Momento de verdad! #{home} vs #{away} está por comenzar 🔥",
        "Los nervios ya están. El partido, también ⚡",
        "¡Deja todo! Hay partido 😤",
        "Calentando... ¿quién crees que gana? 👀",
        "¡Se acerca la hora! Los jugadores ya calientan 💪",
        "¿Snacks listos? Porque esto arranca ya 🍟⚽",
        "¡El momento llegó! Prepárate para sufrir (o gozar) 😅",
        "¡Atención! Esto no lo puedes perderte 📺",
        "Ya están en el túnel. En minutos, fútbol puro ⚡",
        "¡PARTIDAZO a la vista! #{home} vs #{away} 🔥",
        "¿Nervios? Normal. En minutos empieza 💥",
        "El árbitro ya tiene el balón. ¡Que comience! ⚽",
        "¡Silbatazo inicial en minutos! ¿Listo para gritar? 😱",
        "Deja el trabajo, deja la tele, deja todo — hay partido 😄",
        "Esta noche (o este día) es de fútbol. ¡Arrancan! 🏟️"
      ]
      [ "⏰ #{home} vs #{away}", bodies.sample ]

    else
      [ "#{home} vs #{away}", "" ]
    end
  end
end
