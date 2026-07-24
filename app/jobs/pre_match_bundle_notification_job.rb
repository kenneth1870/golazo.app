class PreMatchBundleNotificationJob < ApplicationJob
  queue_as :critical

  # Sends "about to start" pushes for the matches kicking off in the current
  # window. When a subscriber is interested in more than one of them (e.g. two
  # group games kicking off simultaneously), they get a SINGLE notification that
  # lists every relevant matchup with flags — instead of N separate pushes that
  # pile up (or collide) on the device.
  #
  # @param matches [Array<Hash>] one per match, with keys:
  #   :id, :home, :away, :home_code, :away_code, :url, :competition_code
  BATCH_SIZE = 100

  def perform(matches:)
    return unless AppFocus.push_enabled?
    return if matches.blank?
    if ENV["VAPID_PUBLIC_KEY"].blank? || ENV["VAPID_PRIVATE_KEY"].blank?
      Rails.logger.error("[PreMatchBundle] VAPID keys not configured — skipping")
      return
    end

    matches = matches.map(&:symbolize_keys)
    team_names = matches.flat_map { |m| [ m[:home], m[:away] ] }.reject(&:blank?).uniq

    subs = matches.flat_map { |m|
      PushSubscription.for_match(
        home_name: m[:home],
        away_name: m[:away],
        competition_code: m[:competition_code]
      ).to_a
    }.uniq
    subs = subs.select { |s| s.receives_event?("prematch") }
    Rails.logger.info("[PreMatchBundle] #{matches.size} match(es) | #{subs.size} subscriber(s)")
    return if subs.empty?

    # Group subscribers that would receive an identical notification: same locale
    # and the same set of relevant matches. The copy is then built once per group.
    groups = Hash.new { |h, k| h[k] = [] }
    subs.each do |sub|
      relevant_ids = relevant_matches(sub, matches).map { |m| m[:id] }
      next if relevant_ids.empty?
      locale = %w[es en].include?(sub.locale) ? sub.locale : "es"
      groups[[ locale, relevant_ids.sort ]] << sub
    end

    enqueued = 0
    groups.each do |(locale, ids), group_subs|
      relevant = matches.select { |m| ids.include?(m[:id]) }
      title, body = build_copy(locale, relevant)
      url = relevant.size == 1 ? (relevant.first[:url].presence || "/") : "/scores/today"

      payload = {
        title: title,
        body:  body,
        url:   url,
        icon:  "/images/apple-touch-icon.png?v=2",
        badge: "/images/badge-72.png",
        tag:   "prematch-#{ids.join('-')}",
        renotify: true
      }
      payload[:match_id] = relevant.first[:id] if relevant.size == 1
      json = payload.to_json

      group_subs.each_slice(BATCH_SIZE) do |batch|
        DeliverPushJob.perform_later(subscription_ids: batch.map(&:id), payload: json)
        enqueued += 1
      end
    end

    Rails.logger.info("[PreMatchBundle] Enqueued #{enqueued} delivery batch(es) across #{groups.size} group(s)")
  end

  private

  # Which of the window's matches this subscriber cares about — team and/or league scope.
  def relevant_matches(sub, matches)
    followed_teams = sub.team_names.map(&:downcase).to_set
    followed_leagues = sub.competition_codes_list.map(&:upcase).to_set
    has_teams = followed_teams.any?
    has_leagues = followed_leagues.any?
    return [] unless has_teams || has_leagues

    matches.select do |m|
      team_hit = has_teams && (
        followed_teams.include?(m[:home].to_s.downcase) ||
        followed_teams.include?(m[:away].to_s.downcase)
      )
      league_hit = has_leagues && followed_leagues.include?(m[:competition_code].to_s.upcase)
      team_hit || league_hit
    end
  end

  def build_copy(locale, matches)
    lines = matches.map { |m| matchup_line(locale, m) }

    if matches.size == 1
      [ "⏰ #{lines.first}", single_body(locale) ]
    elsif locale == "en"
      [ "⏰ #{matches.size} matches about to start", lines.join("\n") ]
    else
      [ "⏰ #{matches.size} partidos están por empezar", lines.join("\n") ]
    end
  end

  # "🇨🇼 Curaçao vs 🇨🇮 Costa de Marfil" (names localized, flags from team code).
  def matchup_line(locale, match)
    home = TeamNameTranslator.translate(match[:home], locale)
    away = TeamNameTranslator.translate(match[:away], locale)
    "#{[ FlagEmoji.for_code(match[:home_code]), home ].reject(&:blank?).join(' ')}" \
      " vs " \
      "#{[ FlagEmoji.for_code(match[:away_code]), away ].reject(&:blank?).join(' ')}"
  end

  def single_body(locale)
    if locale == "en"
      [ "Almost time — are you ready? ⚡", "Kick-off is near. Don't miss it!",
        "The match is about to start. Let's go!", "Players are on the pitch — it's nearly time!" ].sample
    else
      [ "¡Ya falta poco! ¿Estás listo? ⚡", "¡Está por comenzar! No te lo pierdas.",
        "¡Ponte cómodo, que ya empieza! 👀", "¡Los jugadores ya están en la cancha!" ].sample
    end
  end
end
