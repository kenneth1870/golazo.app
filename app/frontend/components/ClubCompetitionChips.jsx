import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"

export const CLUB_CHIPS = [
  { emoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", key: "clubs.pl", path: "/leagues/PL" },
  { emoji: "🇪🇸", key: "clubs.lal", path: "/leagues/LAL" },
  { emoji: "🇩🇪", key: "clubs.bl1", path: "/leagues/BL1" },
  { emoji: "🇮🇹", key: "clubs.sa", path: "/leagues/SA" },
  { emoji: "🇫🇷", key: "clubs.l1", path: "/leagues/L1" },
  { emoji: "⭐", key: "clubs.ucl", path: "/leagues/UCL" },
  { emoji: "🇨🇷", key: "clubs.crc", path: "/leagues/CRC" },
  { emoji: "🇲🇽", key: "clubs.lmx", path: "/leagues/LMX" },
]

export const NAV_LEAGUES = [
  ...CLUB_CHIPS,
  { emoji: "🇺🇸", key: "clubs.mls", path: "/leagues/MLS" },
]

export default function ClubCompetitionChips({ compact = false }) {
  const { t } = useTranslation()

  return (
    <div style={{
      background: compact ? "transparent" : "var(--surface)",
      border: compact ? "none" : "1px solid var(--border)",
      borderRadius: 14,
      padding: compact ? 0 : "20px 24px",
    }}>
      {!compact && (
        <>
          <div style={{ fontSize: ".62rem", fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
            {t("home.clubCompetitions")}
          </div>
          <div style={{ fontWeight: 900, fontSize: "1.1rem", color: "var(--text)", marginBottom: 12 }}>
            {t("home.liveScoresWorldwide")}
          </div>
        </>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {CLUB_CHIPS.map(({ emoji, key, path }) => (
          <Link key={path} to={path} style={{
            display: "inline-block",
            background: "var(--surface2)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "6px 12px",
            fontSize: ".7rem", fontWeight: 700, color: "var(--text)", textDecoration: "none",
          }}>
            {emoji} {t(key)}
          </Link>
        ))}
        <Link to="/leagues" style={{
          display: "inline-block",
          background: "rgba(238,30,70,.08)", border: "1px solid rgba(238,30,70,.25)",
          borderRadius: 8, padding: "6px 12px",
          fontSize: ".7rem", fontWeight: 700, color: "var(--accent)", textDecoration: "none",
        }}>
          {t("nav.allLeagues")} →
        </Link>
      </div>
    </div>
  )
}
