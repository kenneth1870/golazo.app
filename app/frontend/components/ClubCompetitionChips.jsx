import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"

export const CLUB_CHIPS = [
  { label: "🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League", path: "/leagues/PL" },
  { label: "🇪🇸 La Liga",         path: "/leagues/LAL" },
  { label: "🇩🇪 Bundesliga",      path: "/leagues/BL1" },
  { label: "🇮🇹 Serie A",          path: "/leagues/SA" },
  { label: "🇫🇷 Ligue 1",          path: "/leagues/L1" },
  { label: "⭐ Champions League", path: "/leagues/UCL" },
  { label: "🇨🇷 Liga Tica",       path: "/leagues/CRC" },
  { label: "🇲🇽 Liga MX",         path: "/leagues/LMX" },
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
        {CLUB_CHIPS.map(({ label, path }) => (
          <Link key={path} to={path} style={{
            display: "inline-block",
            background: "var(--surface2)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "6px 12px",
            fontSize: ".7rem", fontWeight: 700, color: "var(--text)", textDecoration: "none",
          }}>
            {label}
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
