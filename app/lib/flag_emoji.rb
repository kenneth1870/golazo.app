# Maps a team's FIFA 3-letter `code` to a Unicode flag emoji.
#
# Push notification bodies are plain text, so the image-based `flag_url` can't be
# shown there — we render emoji flags instead. Codes are converted to ISO 3166-1
# alpha-2 and then to regional-indicator emoji; the home-nation subdivisions
# (England/Scotland/Wales) use Unicode tag sequences instead.
module FlagEmoji
  # FIFA / app `code` → ISO 3166-1 alpha-2. Covers the 48 WC 2026 teams plus a
  # handful of common qualifiers; any unknown code degrades gracefully to "".
  FIFA_TO_ISO2 = {
    "ALG" => "DZ", "ARG" => "AR", "AUS" => "AU", "AUT" => "AT", "BEL" => "BE",
    "BIH" => "BA", "BRA" => "BR", "CAN" => "CA", "CPV" => "CV", "COL" => "CO",
    "CRO" => "HR", "CUW" => "CW", "CZE" => "CZ", "COD" => "CD", "ECU" => "EC",
    "EGY" => "EG", "FRA" => "FR", "GER" => "DE", "GHA" => "GH", "HAI" => "HT",
    "IRN" => "IR", "IRQ" => "IQ", "CIV" => "CI", "JPN" => "JP", "JOR" => "JO",
    "MEX" => "MX", "MAR" => "MA", "NED" => "NL", "NZL" => "NZ", "NOR" => "NO",
    "PAN" => "PA", "PAR" => "PY", "POR" => "PT", "QAT" => "QA", "KSA" => "SA",
    "SEN" => "SN", "RSA" => "ZA", "KOR" => "KR", "ESP" => "ES", "SWE" => "SE",
    "SUI" => "CH", "TUN" => "TN", "TUR" => "TR", "USA" => "US", "URU" => "UY",
    "UZB" => "UZ",
    # Common non-qualified / playoff nations, for resilience to future fixtures.
    "CRC" => "CR", "HON" => "HN", "NGA" => "NG", "CMR" => "CM", "SRB" => "RS",
    "DEN" => "DK", "POL" => "PL", "CHI" => "CL", "PER" => "PE", "VEN" => "VE",
    "BOL" => "BO", "IRL" => "IE", "GRE" => "GR", "ROU" => "RO", "SVK" => "SK",
    "SVN" => "SI", "HUN" => "HU", "UAE" => "AE", "CHN" => "CN", "THA" => "TH",
    "VIE" => "VN", "IDN" => "ID", "IND" => "IN", "MLI" => "ML", "RUS" => "RU",
    "UKR" => "UA"
  }.freeze

  # Subdivision flags that use Unicode tag sequences, not regional indicators.
  TAG_FLAGS = {
    "ENG" => "gbeng", # England
    "SCO" => "gbsct", # Scotland
    "WAL" => "gbwls"  # Wales
  }.freeze

  module_function

  # Flag emoji for a team code, or "" when the code is unknown.
  def for_code(code)
    code = code.to_s.upcase
    return tag_flag(TAG_FLAGS[code]) if TAG_FLAGS.key?(code)

    iso = FIFA_TO_ISO2[code]
    return "" unless iso

    iso.each_char.map { |c| 0x1F1E6 + (c.ord - 65) }.pack("U*")
  end

  # Builds a subdivision flag (🏴 + tag letters + cancel tag), e.g. England.
  def tag_flag(subdivision)
    codepoints = [ 0x1F3F4 ] + subdivision.each_char.map { |c| 0xE0000 + c.ord } + [ 0xE007F ]
    codepoints.pack("U*")
  end
end
