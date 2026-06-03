module Api
  module V1
    class LocaleController < BaseController
      # Maps country code → default language
      COUNTRY_LANG = {
        # Spanish
        "MX" => "es", "AR" => "es", "CO" => "es", "ES" => "es", "PE" => "es",
        "VE" => "es", "CL" => "es", "EC" => "es", "BO" => "es", "PY" => "es",
        "UY" => "es", "CR" => "es", "PA" => "es", "DO" => "es", "HN" => "es",
        "SV" => "es", "NI" => "es", "GT" => "es", "CU" => "es", "PR" => "es",
        # Portuguese
        "BR" => "pt", "PT" => "pt", "AO" => "pt", "MZ" => "pt",
        # French
        "FR" => "fr", "BE" => "fr", "CH" => "fr", "CA" => "fr", "SN" => "fr",
        "CI" => "fr", "CM" => "fr", "ML" => "fr", "BF" => "fr",
        # German
        "DE" => "de", "AT" => "de", "LI" => "de",
        # Arabic
        "SA" => "ar", "MA" => "ar", "DZ" => "ar", "EG" => "ar", "AE" => "ar",
        "QA" => "ar", "KW" => "ar", "BH" => "ar", "OM" => "ar", "JO" => "ar",
        "IQ" => "ar", "SY" => "ar", "LB" => "ar", "YE" => "ar", "LY" => "ar",
        # Japanese
        "JP" => "ja",
        # Korean
        "KR" => "ko",
        # Chinese
        "CN" => "zh", "TW" => "zh", "HK" => "zh",
        # Dutch
        "NL" => "nl", "NL" => "nl",
        # Italian
        "IT" => "it",
        # Default → English
      }.freeze

      def index
        ip = request.remote_ip
        ip = "8.8.8.8" if ip == "127.0.0.1" || ip == "::1" # dev fallback

        geo = fetch_geo(ip)

        country_code = geo[:country_code] || "US"
        lang         = COUNTRY_LANG[country_code] || "en"
        timezone     = geo[:timezone] || "UTC"

        render json: {
          ip:           ip,
          country:      geo[:country],
          country_code: country_code,
          city:         geo[:city],
          timezone:     timezone,
          language:     lang,
          currency:     geo[:currency],
          flag:         "https://flagcdn.com/w40/#{country_code.downcase}.png"
        }
      end

      private

      def fetch_geo(ip)
        response = Faraday.get("http://ip-api.com/json/#{ip}?fields=status,country,countryCode,city,timezone,currency")
        data = JSON.parse(response.body)
        return {} unless data["status"] == "success"
        {
          country:      data["country"],
          country_code: data["countryCode"],
          city:         data["city"],
          timezone:     data["timezone"],
          currency:     data["currency"]
        }
      rescue => e
        Rails.logger.warn("[LocaleController] geo lookup failed: #{e.message}")
        {}
      end
    end
  end
end
