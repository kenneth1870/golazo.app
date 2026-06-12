# Generates a post-match AI summary from raw API-Football v3 data.
# Used for external-only matches (friendlies, club leagues) that have no DB record.
# The companion AiMatchSummaryService covers DB-tracked WC matches.
class AiMatchSummaryExternalService
  CACHE_TTL  = 7.days
  MODEL      = "claude-haiku-4-5-20251001".freeze
  MAX_TOKENS = 500

  # @param data   [Hash]   Normalised match detail: { fixture:, events:, stats:, lineups: }
  # @param lang   [String] BCP-47 language tag ("en", "es", "fr", …); defaults to "en"
  def initialize(data, lang: "en")
    @data = data
    @lang = lang.to_s.downcase[0, 2]  # keep just the primary subtag
  end

  # Returns { summary: "…", generated_at: ISO8601, model: "…" } or nil
  def call
    return nil unless ENV["ANTHROPIC_API_KEY"].present?

    fixture = @data&.dig(:fixture)
    return nil unless fixture

    status = fixture.dig("fixture", "status", "short")
    return nil unless %w[FT AET PEN].include?(status)

    # Stable cache key per fixture + language
    fixture_id = fixture.dig("fixture", "id")
    cache_key  = "ai_ext_summary_v2_#{fixture_id}_#{@lang}"
    cached     = Rails.cache.read(cache_key)
    return cached if cached

    result = generate_summary(fixture)
    if result
      Rails.cache.write(cache_key, result, expires_in: CACHE_TTL)
    end
    result
  rescue => e
    Rails.logger.error("[AiMatchSummaryExternalService] #{e.class}: #{e.message}")
    nil
  end

  private

  def generate_summary(fixture)
    prompt = build_prompt(fixture)
    return nil if prompt.blank?

    resp = anthropic_client.post("/v1/messages") do |req|
      req.headers["Content-Type"]      = "application/json"
      req.headers["x-api-key"]         = ENV["ANTHROPIC_API_KEY"]
      req.headers["anthropic-version"] = "2023-06-01"
      req.body = {
        model:      MODEL,
        max_tokens: MAX_TOKENS,
        system:     system_prompt,
        messages:   [ { role: "user", content: prompt } ]
      }.to_json
    end

    return nil unless resp.success?

    body = JSON.parse(resp.body)
    text = body.dig("content", 0, "text").to_s.strip
    return nil if text.blank?

    {
      summary:      text,
      generated_at: Time.current.iso8601,
      model:        MODEL
    }
  end

  def build_prompt(fixture)
    home_name = fixture.dig("teams", "home", "name").to_s
    away_name = fixture.dig("teams", "away", "name").to_s
    home_score = fixture.dig("goals", "home").to_i
    away_score = fixture.dig("goals", "away").to_i
    comp_name  = fixture.dig("league", "name").to_s
    round      = fixture.dig("league", "round").to_s
    venue      = fixture.dig("fixture", "venue", "name").to_s

    return nil if home_name.blank? || away_name.blank?

    comp_label = [ comp_name, round.presence ].compact.join(" — ")

    # Goal events
    goal_lines = Array(@data[:events])
      .select { |e| e["type"] == "Goal" }
      .sort_by { |e| e["minute"].to_i }
      .map do |e|
        min    = e["minute"].to_i
        detail = e["detail"].to_s
        player = e["player"].to_s
        team   = e.dig("team", "name").to_s
        extra  = case detail
        when /own/i  then " (OG)"
        when /penalty/i then " (pen)"
        else ""
        end
        "#{min}' #{player} (#{team})#{extra}"
      end

    # Key cards
    card_lines = Array(@data[:events])
      .select { |e| e["type"] == "Card" }
      .sort_by { |e| e["minute"].to_i }
      .map do |e|
        min    = e["minute"].to_i
        color  = e["detail"].to_s.downcase.include?("red") ? "🟥" : "🟨"
        player = e["player"].to_s
        team   = e.dig("team", "name").to_s
        "#{color} #{min}' #{player} (#{team})"
      end

    # Stats snippet
    home_stat = Array(@data[:stats]).find { |s| s.dig("team", "name") == home_name }
    away_stat = Array(@data[:stats]).find { |s| s.dig("team", "name") == away_name }
    stats_line = if home_stat && away_stat
      poss_h = stat_val(home_stat, "Ball Possession") || stat_val(home_stat, "Possession")
      poss_a = stat_val(away_stat, "Ball Possession") || stat_val(away_stat, "Possession")
      sot_h  = stat_val(home_stat, "Shots on Goal")   || stat_val(home_stat, "Shots on Target")
      sot_a  = stat_val(away_stat, "Shots on Goal")   || stat_val(away_stat, "Shots on Target")
      parts  = []
      parts << "Possession: #{poss_h} vs #{poss_a}" if poss_h && poss_a
      parts << "Shots on target: #{sot_h} vs #{sot_a}" if sot_h && sot_a
      parts.join(" | ")
    end

    lines = []
    lines << "Match: #{home_name} #{home_score}–#{away_score} #{away_name}"
    lines << "Competition: #{comp_label}" unless comp_label.blank?
    lines << "Venue: #{venue}" unless venue.blank?
    lines << ""
    if goal_lines.any?
      lines << "Goals:"
      lines.concat(goal_lines)
    else
      lines << "No goals scored."
    end
    lines << "" if card_lines.any?
    if card_lines.any?
      lines << "Discipline:"
      lines.concat(card_lines)
    end
    lines << "" if stats_line.present?
    lines << "Stats: #{stats_line}" if stats_line.present?
    lines << ""
    lines << write_instruction

    lines.join("\n")
  end

  # Instruction is language-aware so Claude writes in the right tongue
  def write_instruction
    case @lang
    when "es"
      "Escribe un informe post-partido conciso (2-3 párrafos cortos). Sé factual y directo. Empieza con el resultado y los momentos clave. Termina con un breve análisis. Sin viñetas."
    when "pt"
      "Escreva um relatório pós-jogo conciso (2-3 parágrafos curtos). Seja factual e direto. Comece com o resultado e os momentos-chave. Termine com uma breve análise. Sem marcadores."
    when "fr"
      "Rédigez un rapport d'après-match concis (2-3 courts paragraphes). Soyez factuel et percutant. Commencez par le résultat et les moments clés. Terminez par une brève analyse. Pas de puces."
    when "de"
      "Schreib einen knappen Spielbericht (2-3 kurze Absätze). Sachlich und prägnant. Beginne mit dem Ergebnis und den Schlüsselmomenten. Schließe mit einer kurzen Analyse. Keine Aufzählungspunkte."
    else
      "Write a concise post-match report (2-3 short paragraphs). Be factual and punchy. Start with the result and key moments. End with brief analysis. No bullet points."
    end
  end

  def system_prompt
    case @lang
    when "es"
      "Eres un periodista deportivo que cubre el fútbol internacional. Escribe crónicas de partidos breves y atractivas. Máximo 350 palabras. Español neutro."
    when "pt"
      "Você é um jornalista esportivo cobrindo futebol internacional. Escreva relatórios de partidas curtos e envolventes. Máximo 350 palavras. Português neutro."
    when "fr"
      "Vous êtes journaliste sportif couvrant le football international. Rédigez des comptes rendus de match courts et engageants. Maximum 350 mots. Français standard."
    when "de"
      "Du bist Sportjournalist und berichtest über internationalen Fußball. Schreib kurze, packende Spielberichte. Maximal 350 Wörter. Standarddeutsches."
    else
      "You are a football journalist covering international football. Write sharp, engaging post-match reports. Keep it under 350 words. British English."
    end
  end

  def stat_val(stat_block, type_name)
    Array(stat_block["statistics"])
      .find { |s| s["type"].to_s.downcase == type_name.downcase }
      &.dig("value")
  end

  def anthropic_client
    @anthropic_client ||= Faraday.new("https://api.anthropic.com") do |f|
      f.request  :json
      f.response :raise_error
      f.options.timeout = 25
      f.adapter Faraday.default_adapter
    end
  end
end
