# Shared cache-key helpers for API-Football date lists and the /today endpoint.
module LiveScoresCache
  module_function

  COMMON_TIMEZONES = %w[
    UTC
    America/Costa_Rica
    America/Chicago
    America/Los_Angeles
    America/New_York
    America/Mexico_City
    America/Denver
    Europe/London
    Europe/Madrid
  ].freeze

  LATAM_LEAGUE_CODES = %w[CRC LMX CAC CCC].freeze

  def tz_key(timezone)
    timezone.to_s.gsub(/[^A-Za-z0-9_]/, "_").downcase
  end

  # Drop cached fixture lists for a calendar date across common client timezones.
  def bust_date!(date, timezones: COMMON_TIMEZONES)
    date = date.to_date
    iso  = date.iso8601

    timezones.each do |tz|
      key = tz_key(tz)
      Rails.cache.delete("live_scores_date_v15_#{iso}_#{key}")
      Rails.cache.delete("today_api_v2_#{iso}_#{tz}")
      LATAM_LEAGUE_CODES.each do |code|
        Rails.cache.delete("today_league_v2_#{code}_#{iso}_#{tz}")
      end
    end

    # Legacy keys (pre-timezone fix).
    Rails.cache.delete("live_scores_date_v15_#{iso}_utc")
    Rails.cache.delete("live_scores_date_v15_#{iso}_")
    Rails.cache.delete("today_api_#{iso}")
  end

  # Bust the local calendar date(s) a kickoff spans for the given timezones.
  def bust_kickoff!(kickoff_at, timezones: COMMON_TIMEZONES)
    return if kickoff_at.blank?

    time = Time.parse(kickoff_at.to_s)
    timezones.each do |tz|
      zone = TZInfo::Timezone.get(tz)
      bust_date!(zone.utc_to_local(time.utc).to_date, timezones: [ tz ])
    end
    bust_date!(time.utc.to_date, timezones: [ "UTC" ])
  rescue ArgumentError, TZInfo::InvalidTimezoneIdentifier => e
    Rails.logger.warn("[LiveScoresCache] bust_kickoff!: #{e.message}")
  end
end
