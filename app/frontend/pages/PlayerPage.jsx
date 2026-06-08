import { useState, useEffect } from "react"
import { useParams, useSearchParams, useNavigate, Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { usePageMeta } from "../hooks/usePageMeta"

function StatBox({ label, value, highlight }) {
  return (
    <div style={{
      background: "var(--surface2)", borderRadius: 10, padding: "14px 12px",
      textAlign: "center", flex: "1 1 80px", minWidth: 72,
    }}>
      <div style={{ fontSize: "1.4rem", fontWeight: 900, color: highlight ? "#ee1e46" : "#fff" }}>
        {value ?? "—"}
      </div>
      <div style={{ fontSize: "0.65rem", color: "var(--muted)", marginTop: 3, textTransform: "uppercase", letterSpacing: .5 }}>
        {label}
      </div>
    </div>
  )
}

export default function PlayerPage() {
  const { t }         = useTranslation()
  const { id }        = useParams()
  const [searchParams] = useSearchParams()
  const navigate      = useNavigate()
  const league        = searchParams.get("league") || "4"
  const season        = searchParams.get("season") || "2026"

  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]    = useState(false)

  usePageMeta(
    player?.name || "Player",
    player ? `${player.name} — stats, goals, assists at FIFA World Cup 2026` : null
  )

  useEffect(() => {
    setLoading(true)
    setError(false)
    fetch(`/api/v1/players/${id}?league=${league}&season=${season}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(true)
        else setPlayer(d)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id, league, season])

  if (loading) return (
    <div className="site-section">
      <div className="container" style={{ maxWidth: 600 }}>
        <div className="loading-shimmer" style={{ height: 300, borderRadius: 12, marginTop: 16 }} />
      </div>
    </div>
  )

  if (error || !player) return (
    <div className="site-section">
      <div className="container" style={{ maxWidth: 600 }}>
        <div className="match-back-bar">
          <button onClick={() => navigate(-1)} className="btn-back" style={{ padding: "10px 0" }}>← {t("nav.back")}</button>
        </div>
        <div className="empty-state">
          <div className="empty-state__icon">👤</div>
          <h3>{t("player.notFound")}</h3>
          <p>{t("player.statsUnavailable")}</p>
        </div>
      </div>
    </div>
  )

  const { name, age, nationality, photo, position, team, stats } = player

  return (
    <div className="site-section">
      <div className="container" style={{ maxWidth: 600 }}>
        {/* Back bar */}
        <div className="match-back-bar">
          <button onClick={() => navigate(-1)} className="btn-back" style={{ padding: "10px 0" }}>← {t("nav.back")}</button>
        </div>

        {/* Hero */}
        <div style={{
          background: "linear-gradient(135deg, #0d1117 0%, #161b22 100%)",
          borderBottom: "1px solid var(--border)", padding: "28px 0 24px",
          marginBottom: 20,
        }}>
          <div className="container" style={{ maxWidth: 600 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              {photo ? (
                <img src={photo} alt={name}
                  style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover", border: "2px solid var(--border)", flexShrink: 0 }}
                  onError={e => (e.target.style.display = "none")} />
              ) : (
                <div style={{ width: 80, height: 80, borderRadius: "50%", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", flexShrink: 0 }}>👤</div>
              )}
              <div>
                <h1 style={{ margin: "0 0 6px", fontSize: "1.5rem", fontWeight: 900, color: "#fff" }}>{name}</h1>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {position && (
                    <span style={{ background: "rgba(238,30,70,.15)", color: "#ee1e46", borderRadius: 20, padding: "2px 10px", fontSize: "0.72rem", fontWeight: 700 }}>
                      {position}
                    </span>
                  )}
                  {nationality && (
                    <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>🌍 {nationality}</span>
                  )}
                  {age && (
                    <span style={{ color: "var(--muted)", fontSize: "0.78rem" }}>{t("player.age", { age })}</span>
                  )}
                </div>
                {team?.name && (
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    {team.logo && <img src={team.logo} alt="" style={{ width: 20, height: 20, objectFit: "contain" }} onError={e => (e.target.style.display="none")} />}
                    <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,.7)", fontWeight: 600 }}>{team.name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        {stats && (
          <div className="widget-next-match" style={{ marginBottom: 20 }}>
            <div className="widget-title"><h3>{t("player.wcStats")}</h3></div>
            <div className="widget-body">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <StatBox label={t("player.goals")}     value={stats.goals}       highlight />
                <StatBox label={t("player.assists")}   value={stats.assists} />
                <StatBox label={t("player.apps")}      value={stats.appearances} />
                <StatBox label={t("player.minutes")}   value={stats.minutes} />
                <StatBox label={t("player.rating")}    value={stats.rating ? Number(stats.rating).toFixed(1) : null} />
                <StatBox label={t("player.yellow")}    value={stats.yellow_cards} />
                <StatBox label={t("player.red")}       value={stats.red_cards} />
                <StatBox label={t("player.keyPasses")} value={stats.key_passes} />
              </div>
            </div>
          </div>
        )}

        {!stats?.goals && !stats?.appearances && (
          <div style={{ textAlign: "center", color: "var(--muted)", padding: "24px 0", fontSize: "0.85rem" }}>
            {t("player.detailedStatsUnavailable")}
          </div>
        )}
      </div>
    </div>
  )
}
