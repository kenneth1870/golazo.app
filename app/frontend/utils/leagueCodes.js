export const LEAGUE_API_IDS = {
  WC: 1, PL: 39, LAL: 140, BL1: 78, SA: 135, L1: 61, MLS: 253, CRC: 162, LMX: 262, UCL: 2,
}

const API_ID_TO_CODE = Object.fromEntries(
  Object.entries(LEAGUE_API_IDS).map(([code, id]) => [String(id), code])
)

export function leagueCodeFromApiId(id) {
  if (id == null) return null
  return API_ID_TO_CODE[String(id)] ?? null
}
