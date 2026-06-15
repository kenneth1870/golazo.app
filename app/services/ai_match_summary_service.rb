# Generates a post-match narrative summary using the Anthropic Claude API.
# Covers DB-tracked matches (i.e., WC matches synced via WorldCupSync).
# For external-only matches use AiMatchSummaryExternalService.
# Caches the result for 7 days so we only call the API once per match.
class AiMatchSummaryService
  CACHE_TTL  = 7.days
  MODEL      = "claude-haiku-4-5-20251001".freeze
  MAX_TOKENS = 500

  # @param match  [Match]  AR record, should include :home_team, :away_team, :goals, :match_stats, :competition
  # @param lang   [String] BCP-47 language tag ("en", "es", …); defaults to "en"
  def initialize(match, lang: "en")
    @match = match
    @lang  = lang.to_s.downcase[0, 2]
  end

  # Returns { summary: "...", generated_at: ISO8601, model: "..." } or nil
  def call
    return nil unless ENV["ANTHROPIC_API_KEY"].present?
    return nil unless @match.status == "finished"

    cache_key = "ai_match_summary_v3_#{@match.id}_#{@lang}"
    cached    = Rails.cache.read(cache_key)
    return cached if cached

    result = generate_summary
    if result
      Rails.cache.write(cache_key, result, expires_in: CACHE_TTL)
    end
    result
  rescue => e
    Rails.logger.error("[AiMatchSummaryService] #{e.class}: #{e.message}")
    nil
  end

  private

  def generate_summary
    attempt = 0
    begin
      attempt += 1
      resp = anthropic_client.post("/v1/messages") do |req|
        req.headers["Content-Type"]      = "application/json"
        req.headers["x-api-key"]         = ENV["ANTHROPIC_API_KEY"]
        req.headers["anthropic-version"] = "2023-06-01"
        req.body = {
          model:      MODEL,
          max_tokens: MAX_TOKENS,
          system:     system_prompt,
          messages:   [ { role: "user", content: build_prompt } ]
        }.to_json
      end

      return nil unless resp.success?

      body = JSON.parse(resp.body)
      text = body.dig("content", 0, "text").to_s.strip
      return nil if text.blank?

      { summary: text, generated_at: Time.current.iso8601, model: MODEL }
    rescue Faraday::TimeoutError, Faraday::ConnectionFailed => e
      raise if attempt >= 3
      sleep(attempt * 2)
      retry
    end
  end

  def build_prompt
    home = @match.home_team&.name || "Home"
    away = @match.away_team&.name || "Away"
    hs   = @match.home_score.to_i
    as_  = @match.away_score.to_i
    comp = @match.competition&.name || "FIFA World Cup 2026"

    round_label = [ @match.group_stage.presence && "Group Stage", @match.round.presence ].compact.join(" — ")
    comp_label  = [ comp, round_label.presence ].compact.join(" — ")

    # Goal events
    goal_lines = @match.goals.order(:minute).map do |g|
      suffix = case g.goal_type.to_s
      when "own_goal" then " (OG)"
      when "penalty"  then " (pen)"
      else ""
      end
      "#{g.minute}' #{g.player_name} (#{g.team&.name})#{suffix}"
    end

    # Stats
    home_stat = @match.match_stats.find { |s| s.team_id == @match.home_team_id }
    away_stat = @match.match_stats.find { |s| s.team_id == @match.away_team_id }
    stats_text = if home_stat && away_stat
      parts = []
      parts << "Possession: #{home_stat.possession}% vs #{away_stat.possession}%" if home_stat.possession
      parts << "Shots on target: #{home_stat.shots_on_target} vs #{away_stat.shots_on_target}" if home_stat.shots_on_target
      parts.join(" | ")
    end

    lines = []
    lines << "Match: #{home} #{hs}–#{as_} #{away}"
    lines << "Competition: #{comp_label}"
    lines << ""
    lines << (goal_lines.any? ? "Goals:\n#{goal_lines.join("\n")}" : "No goals scored.")
    lines << "Stats: #{stats_text}" if stats_text.present?
    lines << ""
    lines << write_instruction

    lines.join("\n")
  end

  def write_instruction
    case @lang
    when "es"
      "Escribe un informe post-partido conciso (2-3 párrafos cortos). Sé factual y directo. Empieza con el resultado y los momentos clave. Termina con un breve análisis. Sin viñetas."
    when "pt"
      "Escreva um relatório pós-jogo conciso (2-3 parágrafos curtos). Seja factual e direto. Comece com o resultado e os momentos-chave. Termine com uma breve análise. Sem marcadores."
    when "fr"
      "Rédigez un rapport d'après-match concis (2-3 courts paragraphes). Soyez factuel et percutant. Commencez par le résultat et les moments clés. Terminez par une brève analyse. Pas de puces."
    else
      "Write a concise post-match report (2-3 short paragraphs). Be factual and punchy. Start with the result and key moments. End with brief analysis. No bullet points."
    end
  end

  def system_prompt
    case @lang
    when "es"
      "Eres un periodista deportivo que cubre la Copa Mundial FIFA 2026. Escribe crónicas de partidos breves y atractivas. Máximo 350 palabras. Español neutro."
    when "pt"
      "Você é um jornalista esportivo cobrindo a Copa do Mundo FIFA 2026. Escreva relatórios de partidas curtos e envolventes. Máximo 350 palavras."
    when "fr"
      "Vous êtes journaliste sportif couvrant la Coupe du Monde FIFA 2026. Rédigez des comptes rendus de match courts et engageants. Maximum 350 mots. Français standard."
    else
      "You are a football journalist covering the FIFA World Cup 2026. Write sharp, engaging post-match reports. Keep it under 350 words. British English."
    end
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
