import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { usePageMeta } from "../../hooks/usePageMeta"
import { translateTeam } from "../../i18n/teamNames"

const MEDALS = ["🥇", "🥈", "🥉"]
const RANK_COLORS = ["#f59e0b", "#94a3b8", "#cd7f32"]

// ─── Top scorer hero card ─────────────────────────────
function GoldenBootHero({ scorer, t, lang }) {
  if (!scorer) return null
  const goals    = scorer.goals ?? 0
  const teamName = translateTeam(scorer.team?.name, lang)

  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(245,158,11,.12) 0%, rgba(238,30,70,.08) 100%)",
      border: "1px solid rgba(245,158,11,.35)",
      borderRadius: 16, padding: "20px 24px", marginBottom: 20,
      display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
    }}>
      {/* Boot icon + rank */}
      <div style={{ textAlign: "center", flexShrink: 0 }}>
        <div style={{ fontSize: "2.8rem", lineHeight: 1 }}>👟</div>
        <div style={{ fontSize: "0.6rem", fontWeight: 800, letterSpacing: ".12em", color: "#f59e0b", textTransform: "uppercase", marginTop: 4 }}>
          {t("mundial.goldenBootLeader")}
        </div>
      </div>

      {/* Team flag */}
      {scorer.team?.crest && (
        <img src={scorer.team.crest} alt={teamName} style={{ width: 56, height: 56, objectFit: "contain", flexShrink: 0 }}
          onError={e => (e.target.style.display = "none")} />
      )}

      {/* Name + info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: 2 }}>{teamName}</div>
        {scorer.player?.id ? (
          <Link to={`/players/${scorer.player.id}?league=4&season=2026`}
            style={{ color: "#fff", fontWeight: 900, fontSize: "1.2rem", textDecoration: "none", display: "block" }}>
            {scorer.player?.name}
          </Link>
        ) : (
          <div style={{ color: "#fff", fontWeight: 900, fontSize: "1.2rem" }}>{scorer.player?.name}</div>
        )}
        <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 2 }}>
          {scorer.assists ?? 0} {t("mundial.assists")} · {scorer.played ?? 0} {t("mundial.gamesPlayed")}
        </div>
      </div>

      {/* Goals number */}
      <div style={{ textAlign: "center", flexShrink: 0 }}>
        <div style={{ fontSize: "3rem", fontWeight: 900, color: "#f59e0b", lineHeight: 1 }}>{goals}</div>
        <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--muted)", letterSpacing: ".1em", textTransform: "uppercase" }}>
          {t("mundial.goals")}
        </div>
      </div>
    </div>
  )
}

// ─── Single scorer row with progress bar ─────────────
function ScorerRow({ scorer, rank, maxGoals, t, lang }) {
  const goals     = scorer.goals ?? 0
  const pct       = maxGoals > 0 ? Math.round((goals / maxGoals) * 100) : 0
  const teamName  = translateTeam(scorer.team?.name, lang)
  const medal     = MEDALS[rank]
  const rankColor = RANK_COLORS[rank]

  return (
    <div style={{
      padding: "14px 20px",
      borderBottom: "1px solid var(--border)",
      display: "grid",
      gridTemplateColumns: "28px 1fr auto",
      gap: 12,
      alignItems: "center",
    }}>
      {/* Rank */}
      <div style={{ textAlign: "center", fontWeight: 800, fontSize: "0.85rem", color: rankColor ?? "var(--muted)" }}>
        {medal ?? rank + 1}
      </div>

      {/* Player info + bar */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
          {scorer.team?.crest && (
            <img src={scorer.team.crest} alt="" style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }}
              onError={e => (e.target.style.display = "none")} />
          )}
          {scorer.player?.id ? (
            <Link to={`/players/${scorer.player.id}?league=4&season=2026`}
              style={{ color: "#fff", fontWeight: 700, fontSize: "0.88rem", textDecoration: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {scorer.player?.name}
            </Link>
          ) : (
            <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.88rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {scorer.player?.name}
            </span>
          )}
          <span style={{ fontSize: "0.7rem", color: "var(--muted)", flexShrink: 0 }}>{teamName}</span>
        </div>

        {/* Progress bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, height: 5, borderRadius: 3, background: "var(--surface2)", overflow: "hidden" }}>
            <div style={{
              width: `${pct}%`, height: "100%",
              background: rank === 0 ? "linear-gradient(90deg, #f59e0b, #ee1e46)" : "#3b82f6",
              borderRadius: 3, transition: "width .5s ease",
            }} />
          </div>
          <span style={{ fontSize: "0.65rem", color: "var(--muted)", flexShrink: 0, minWidth: 28, textAlign: "right" }}>
            {scorer.assists ?? 0} ast
          </span>
        </div>
      </div>

      {/* Goals */}
      <div style={{ textAlign: "right" }}>
        <span style={{
          fontSize: "1.25rem", fontWeight: 900,
          color: rank === 0 ? "#f59e0b" : "#fff",
        }}>
          {goals}
        </span>
        <div style={{ fontSize: "0.6rem", color: "var(--muted)" }}>{t("mundial.goals")}</div>
      </div>
    </div>
  )
}

export default function ScorersPage() {
  const { t, i18n } = useTranslation()
  usePageMeta(t("mundial.scorersTitle"), "Top scorers at FIFA World Cup 2026 — goals, assists and games played.")
  const [scorers, setScorers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/v1/top_scorers?competition=WC")
      .then(r => r.json())
      .then(setScorers)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="site-section container">
      <div className="loading-shimmer" style={{ height: 140, borderRadius: 16, marginBottom: 16 }} />
      {[...Array(8)].map((_, i) => (
        <div key={i} className="loading-shimmer" style={{ height: 68, borderRadius: 8, marginBottom: 8 }} />
      ))}
    </div>
  )

  if (scorers.length === 0) return (
    <div className="site-section">
      <div className="container">
        <div className="empty-state">
          <div className="empty-state__icon">👟</div>
          <h3>{t("mundial.noScorers")}</h3>
          <p>{t("mundial.scorersAppear")}</p>
        </div>
      </div>
    </div>
  )

  const leader   = scorers[0]
  const maxGoals = leader?.goals ?? 1
  const rest     = scorers.slice(1)

  return (
    <div className="site-section">
      <div className="container">

        {/* Page title */}
        <h2 style={{ fontSize: "1.1rem", fontWeight: 900, color: "#fff", marginBottom: 4, letterSpacing: ".5px" }}>
          {t("mundial.goldenBoot")} 🏆
        </h2>
        <p style={{ color: "var(--muted)", fontSize: "0.8rem", marginBottom: 20 }}>
          FIFA World Cup 2026
        </p>

        {/* Hero — #1 scorer */}
        <GoldenBootHero scorer={leader} t={t} lang={i18n.language} />

        {/* Rest of leaderboard */}
        {rest.length > 0 && (
          <div className="widget-next-match" style={{ overflow: "hidden" }}>
            {rest.map((s, i) => (
              <ScorerRow
                key={i}
                scorer={s}
                rank={i + 1}
                maxGoals={maxGoals}
                t={t}
                lang={i18n.language}
              />
            ))}
            <div style={{ borderBottom: "none", paddingBottom: 4 }} />
          </div>
        )}

      </div>
    </div>
  )
}
