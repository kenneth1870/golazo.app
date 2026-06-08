# Generates a post-match narrative summary using the Anthropic Claude API.
# Caches the result in SolidCache (expires 7 days) so we only call the API once per match.
class AiMatchSummaryService
  CACHE_TTL    = 7.days
  MODEL        = "claude-haiku-4-5".freeze
  MAX_TOKENS   = 400

  def initialize(match)
    @match = match
  end

  # Returns { summary: "...", generated_at: Time } or nil if unavailable
  def call
    return nil unless ENV["ANTHROPIC_API_KEY"].present?
    return nil unless @match.status == "finished"

    cache_key = "ai_match_summary_v2_#{@match.id}"
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
    prompt = build_prompt
    resp   = anthropic_client.post("/v1/messages") do |req|
      req.headers["Content-Type"]         = "application/json"
      req.headers["x-api-key"]            = ENV["ANTHROPIC_API_KEY"]
      req.headers["anthropic-version"]    = "2023-06-01"
      req.body = {
        model:      MODEL,
        max_tokens: MAX_TOKENS,
        messages:   [{ role: "user", content: prompt }],
        system:     system_prompt,
      }.to_json
    end

    return nil unless resp.success?

    body    = JSON.parse(resp.body)
    text    = body.dig("content", 0, "text").to_s.strip
    return nil if text.blank?

    {
      summary:      text,
      generated_at: Time.current.iso8601,
      model:        MODEL,
    }
  end

  def build_prompt
    home = @match.home_team&.name || "Home"
    away = @match.away_team&.name || "Away"
    hs   = @match.home_score.to_i
    as_  = @match.away_score.to_i
    comp = @match.competition&.name || "FIFA World Cup 2026"

    # Goal events
    goals = @match.goals.order(:minute).map do |g|
      "#{g.minute}' — #{g.player_name} (#{g.team&.name}) #{g.goal_type == 'own_goal' ? '[OG]' : g.goal_type == 'penalty' ? '[P]' : ''}"
    end

    # Stats
    home_stat = @match.match_stats.find { |s| s.team_id == @match.home_team_id }
    away_stat = @match.match_stats.find { |s| s.team_id == @match.away_team_id }

    stats_text = ""
    if home_stat && away_stat
      stats_text = "\nStats — possession: #{home_stat.possession}% vs #{away_stat.possession}%" \
                   " | shots on target: #{home_stat.shots_on_target} vs #{away_stat.shots_on_target}"
    end

    <<~PROMPT
      Match: #{home} #{hs}–#{as_} #{away}
      Competition: #{comp}
      #{goals.any? ? "Goals:\n#{goals.join("\n")}" : "No goals scored."}
      #{stats_text}

      Write a concise post-match report (2-3 short paragraphs). Be factual and punchy.
      Start with the result and key moments. End with brief analysis. No bullet points.
    PROMPT
  end

  def system_prompt
    "You are a football journalist covering the FIFA World Cup 2026. Write sharp, engaging post-match reports. Keep it under 350 words. British English."
  end

  def anthropic_client
    @anthropic_client ||= Faraday.new("https://api.anthropic.com") do |f|
      f.request  :json
      f.response :raise_error
      f.options.timeout = 20
      f.adapter  Faraday.default_adapter
    end
  end
end
