import { useState, useEffect, useRef } from "react"
import { useParams, useSearchParams, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { usePageMeta } from "../hooks/usePageMeta"
import { useAppFocus } from "../hooks/useAppFocus"

function StatBox({ label, value, highlight }) {
  return (
    <div style={{
      background: "var(--surface2)", borderRadius: 10, padding: "14px 12px",
      textAlign: "center", flex: "1 1 80px", minWidth: 72,
    }}>
      <div style={{ fontSize: "1.4rem", fontWeight: 900, color: highlight ? "#ee1e46" : "var(--text)" }}>
        {value ?? "—"}
      </div>
      <div style={{ fontSize: "0.65rem", color: "var(--muted)", marginTop: 3, textTransform: "uppercase", letterSpacing: .5 }}>
        {label}
      </div>
    </div>
  )
}

// ─── Trophies Tab ─────────────────────────────────────────────────────────────

function TrophiesTab({ playerId, t }) {
  const [trophies, setTrophies] = useState(null)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    fetch(`/api/v1/players/${playerId}/trophies`)
      .then(r => r.json())
      .then(setTrophies)
      .catch(() => setTrophies([]))
  }, [playerId])

  if (!trophies) return <div className="loading-shimmer" style={{ height: 200, borderRadius: 12, margin: "20px 0" }} />

  if (!trophies.length) return (
    <div className="empty-state" style={{ paddingTop: 40 }}>
      <div className="empty-state__icon">🏆</div>
      <h3>{t("player.noTrophies")}</h3>
    </div>
  )

  const winners  = trophies.filter(t => t.place === "Winner")
  const runnerUp = trophies.filter(t => t.place === "Runner-up")

  return (
    <div style={{ paddingTop: 8 }}>
      {/* Summary row */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        {[
          { label: t("player.winner"), count: winners.length, color: "#f59e0b", icon: "🥇" },
          { label: t("player.runnerUp"), count: runnerUp.length, color: "#94a3b8", icon: "🥈" },
        ].map(({ label, count, color, icon }) => (
          <div key={label} style={{
            flex: 1, background: "var(--surface2)", borderRadius: 12, padding: "16px 12px", textAlign: "center",
          }}>
            <div style={{ fontSize: "1.6rem", marginBottom: 6 }}>{icon}</div>
            <div style={{ fontWeight: 900, fontSize: "1.4rem", color }}>{count}</div>
            <div style={{ fontSize: "0.65rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: .5, marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Trophy list */}
      <div className="widget-next-match">
        <div className="widget-body p-0">
          {trophies.slice(0, 40).map((trophy, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "10px 16px", borderBottom: "1px solid var(--border)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                <span style={{ fontSize: "1rem", flexShrink: 0 }}>
                  {trophy.place === "Winner" ? "🏆" : trophy.place === "Runner-up" ? "🥈" : "🎖️"}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {trophy.league}
                  </div>
                  {trophy.country && (
                    <div style={{ fontSize: "0.68rem", color: "var(--muted)" }}>{trophy.country}</div>
                  )}
                </div>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 8 }}>
                <div style={{
                  fontSize: "0.7rem", fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                  background: trophy.place === "Winner" ? "rgba(245,158,11,.15)" : "rgba(148,163,184,.1)",
                  color: trophy.place === "Winner" ? "#f59e0b" : "#94a3b8",
                }}>
                  {trophy.place === "Winner" ? t("player.winner") : trophy.place === "Runner-up" ? t("player.runnerUp") : trophy.place}
                </div>
                <div style={{ fontSize: "0.65rem", color: "var(--muted)", marginTop: 2 }}>{trophy.season}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}



// ─── Injuries Tab ─────────────────────────────────────────────────────────────

function InjuriesTab({ playerId, t }) {
  const [injuries, setInjuries] = useState(null)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    fetch(`/api/v1/players/${playerId}/sidelined`)
      .then(r => r.json())
      .then(setInjuries)
      .catch(() => setInjuries([]))
  }, [playerId])

  if (!injuries) return <div className="loading-shimmer" style={{ height: 200, borderRadius: 12, margin: "20px 0" }} />

  if (!injuries.length) return (
    <div className="empty-state" style={{ paddingTop: 40 }}>
      <div className="empty-state__icon">🏥</div>
      <h3>{t("player.noInjuries")}</h3>
    </div>
  )

  function daysBetween(start, end) {
    if (!start || !end) return null
    const d = Math.round((new Date(end) - new Date(start)) / 86400000)
    return d > 0 ? d : null
  }

  function injuryColor(type) {
    if (!type) return "#94a3b8"
    const lower = type.toLowerCase()
    if (lower.includes("muscle") || lower.includes("hamstring") || lower.includes("thigh")) return "#ef4444"
    if (lower.includes("ankle") || lower.includes("knee") || lower.includes("foot")) return "#f97316"
    if (lower.includes("calf") || lower.includes("groin")) return "#f59e0b"
    return "#94a3b8"
  }

  return (
    <div style={{ paddingTop: 8 }}>
      <div className="widget-next-match">
        <div className="widget-body p-0">
          {injuries.slice(0, 30).map((inj, i) => {
            const days = daysBetween(inj.start, inj.end_date)
            const color = injuryColor(inj.type)
            return (
              <div key={i} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 16px", borderBottom: "1px solid var(--border)",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text)" }}>{inj.type || "—"}</div>
                    <div style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: 1 }}>
                      {inj.start}
                      {inj.end_date && ` → ${inj.end_date}`}
                    </div>
                  </div>
                </div>
                {days && (
                  <span style={{
                    background: "var(--surface2)", color: "var(--muted)",
                    borderRadius: 6, padding: "2px 8px", fontSize: "0.7rem", fontWeight: 600, flexShrink: 0,
                  }}>
                    {t("player.injuryDays", { days })}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const PLAYER_TABS = ["stats", "trophies", "injuries"]

export default function PlayerPage() {
  const { t }         = useTranslation()
  const { clubs_primary: clubsPrimary } = useAppFocus()
  const { id }        = useParams()
  const [searchParams] = useSearchParams()
  const navigate      = useNavigate()
  const leagueParam = searchParams.get("league")
  const seasonParam = searchParams.get("season")
  const league      = leagueParam ?? (clubsPrimary ? null : "1")
  const season      = seasonParam ?? (clubsPrimary ? null : "2026")
  const [playerTab, setPlayerTab] = useState("stats")

  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]    = useState(false)

  usePageMeta(
    player?.name || t("player.notFound"),
    player
      ? (clubsPrimary
          ? t("meta.playerDescClubs", { name: player.name })
          : t("meta.playerDescWC", { name: player.name }))
      : null
  )

  useEffect(() => {
    setLoading(true)
    setError(false)
    const qs = new URLSearchParams()
    if (league) qs.set("league", league)
    if (season) qs.set("season", season)
    const query = qs.toString()
    fetch(`/api/v1/players/${id}${query ? `?${query}` : ""}`)
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
          marginBottom: 0,
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
                    {team.logo && <img src={team.logo} alt={team.name} style={{ width: 20, height: 20, objectFit: "contain" }} onError={e => (e.target.style.display="none")} />}
                    <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,.7)", fontWeight: 600 }}>{team.name}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="tab-bar" style={{ marginBottom: 0 }}>
          <div className="tab-bar__inner">
            {PLAYER_TABS.map(k => (
              <button
                key={k}
                className={`tab-link${playerTab === k ? " tab-link--active" : ""}`}
                onClick={() => setPlayerTab(k)}
              >
                {t(`player.${k}`)}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: "20px 0 40px" }}>
          {playerTab === "stats" && (
            <>
              {stats && (
                <div className="widget-next-match" style={{ marginBottom: 20 }}>
                  <div className="widget-title"><h3>{clubsPrimary ? t("player.seasonStats") : t("player.wcStats")}</h3></div>
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
            </>
          )}

          {playerTab === "trophies" && <TrophiesTab playerId={id} t={t} />}
          {playerTab === "injuries" && <InjuriesTab playerId={id} t={t} />}
        </div>
      </div>
    </div>
  )
}
