import { useState, useEffect } from "react"
import { useParams, useNavigate, Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { translateTeam } from "../../i18n/teamNames"
import { usePageMeta } from "../../hooks/usePageMeta"

const COUNTRY_FLAG = { "USA": "🇺🇸", "Canada": "🇨🇦", "Mexico": "🇲🇽" }

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function fmtKickoff(utc) {
  if (!utc) return ""
  return new Date(utc).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

function MatchRow({ match }) {
  const { i18n } = useTranslation()
  const navigate  = useNavigate()
  const isLive     = match.status === "live"
  const isFinished = match.status === "finished"
  const hasScore   = match.home_score != null && match.away_score != null

  return (
    <div
      className={`match-row${match.external_id ? " match-row--clickable" : ""}`}
      onClick={() => match.external_id && navigate(`/matches/${match.external_id}`)}
      style={{ cursor: match.external_id ? "pointer" : "default" }}
    >
      <div className="match-row__status">
        {isLive
          ? <span className="match-status-live"><span className="live-dot" />{match.minute ? `${match.minute}'` : "LIVE"}</span>
          : isFinished
          ? <span className="match-status-ft">FT</span>
          : <span className="match-status-time">{fmtKickoff(match.kickoff_at)}</span>
        }
      </div>
      <div className="match-row__teams">
        <div className="match-row__team match-row__team--home">
          {match.home_team?.flag_url && <img src={match.home_team.flag_url} alt="" className="flag-xs" onError={e => (e.target.style.display = "none")} />}
          <span className="team-name">{translateTeam(match.home_team?.name, i18n.language)}</span>
        </div>
        <div className="match-row__score">
          {hasScore
            ? <span className={`score-pill${isLive ? " score-pill--live" : ""}`}>{match.home_score} – {match.away_score}</span>
            : <span className="score-pill score-pill--vs">vs</span>
          }
        </div>
        <div className="match-row__team match-row__team--away">
          <span className="team-name">{translateTeam(match.away_team?.name, i18n.language)}</span>
          {match.away_team?.flag_url && <img src={match.away_team.flag_url} alt="" className="flag-xs" onError={e => (e.target.style.display = "none")} />}
        </div>
      </div>
      <div className="match-row__meta">
        <span style={{ fontSize: "0.62rem", color: "var(--muted)" }}>
          {match.round || (match.group_stage ? `Group ${match.group_stage}` : "")}
        </span>
      </div>
    </div>
  )
}

export default function VenueShowPage() {
  const { slug }    = useParams()
  const navigate    = useNavigate()
  const { t }       = useTranslation()
  const [venue, setVenue]       = useState(null)
  const [loading, setLoading]   = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetch(`/api/v1/venues/${slug}`)
      .then(r => { if (!r.ok) throw new Error("not found"); return r.json() })
      .then(setVenue)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [slug])

  usePageMeta(
    venue ? `${venue.name} — Mundial 2026` : "Estadio",
    venue ? `${venue.name}, ${venue.city}. Capacidad: ${venue.capacity?.toLocaleString()}. Partidos del FIFA Mundial 2026.` : ""
  )

  if (loading) {
    return (
      <div className="site-section container">
        <div className="loading-shimmer" style={{ height: 200, borderRadius: 12, marginBottom: 16 }} />
        <div className="loading-shimmer" style={{ height: 400, borderRadius: 12 }} />
      </div>
    )
  }

  if (notFound || !venue) {
    return (
      <div className="site-section container" style={{ textAlign: "center", padding: "48px 16px" }}>
        <div style={{ fontSize: "3rem", marginBottom: 12 }}>🏟️</div>
        <p style={{ color: "var(--muted)" }}>Estadio no encontrado.</p>
        <Link to="/mundial/venues" style={{ color: "var(--accent)" }}>← {t("mundial.venuesTitle")}</Link>
      </div>
    )
  }

  const flag        = COUNTRY_FLAG[venue.country] || "🌍"
  const played      = venue.matches?.filter(m => m.status === "finished").length || 0
  const upcoming    = venue.matches?.filter(m => m.status !== "finished" && m.status !== "live").length || 0
  const liveMatches = venue.matches?.filter(m => m.status === "live") || []
  const isFinal     = venue.group?.toLowerCase().includes("final")
  const isOpening   = venue.group?.toLowerCase().includes("opening")

  return (
    <div className="site-section">
      <div className="container">
        {/* Back */}
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={() => navigate("/mundial/venues")}
            style={{
              background: "none",
              border: "none",
              color: "var(--accent)",
              cursor: "pointer",
              fontSize: "0.85rem",
              padding: 0,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            ← {t("mundial.venuesTitle")}
          </button>
        </div>

        {/* Header card */}
        <div
          className="venue-card"
          style={{
            marginBottom: 24,
            padding: "28px 24px",
            background: "linear-gradient(135deg, var(--card-bg) 0%, rgba(238,30,70,0.08) 100%)",
            borderLeft: "4px solid var(--accent)",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: "2rem", marginBottom: 6 }}>🏟️</div>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 800, marginBottom: 4, color: "var(--text)" }}>
                {venue.name}
              </h1>
              <div style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
                {flag} {venue.city} · {venue.country}
              </div>
            </div>
            {(isFinal || isOpening) && (
              <span style={{
                background: "var(--accent)",
                color: "#fff",
                fontSize: "0.7rem",
                fontWeight: 700,
                padding: "4px 10px",
                borderRadius: 20,
                alignSelf: "flex-start",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}>
                {venue.group}
              </span>
            )}
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 24, marginTop: 20, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "0.68rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                {t("mundial.capacity")}
              </div>
              <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text)" }}>
                {venue.capacity?.toLocaleString()}
              </div>
            </div>
            {venue.matches?.length > 0 && (
              <div>
                <div style={{ fontSize: "0.68rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                  Partidos
                </div>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--text)" }}>
                  {venue.matches.length}
                </div>
              </div>
            )}
            {played > 0 && (
              <div>
                <div style={{ fontSize: "0.68rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                  Jugados
                </div>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "#10b981" }}>
                  {played}
                </div>
              </div>
            )}
            {upcoming > 0 && (
              <div>
                <div style={{ fontSize: "0.68rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                  Próximos
                </div>
                <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--accent)" }}>
                  {upcoming}
                </div>
              </div>
            )}
            {!isFinal && !isOpening && venue.group && (
              <div>
                <div style={{ fontSize: "0.68rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 2 }}>
                  Fase
                </div>
                <div style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text)" }}>
                  {venue.group}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Live matches first */}
        {liveMatches.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div className="title-section">
              <h2 className="heading" style={{ fontSize: "1rem" }}>
                <span className="match-status-live" style={{ marginRight: 8 }}><span className="live-dot" />EN VIVO</span>
              </h2>
            </div>
            <div className="match-section">
              {liveMatches.map(m => <MatchRow key={m.id} match={m} />)}
            </div>
          </div>
        )}

        {/* All matches */}
        {venue.matches?.length > 0 ? (
          <div>
            <div className="title-section">
              <h2 className="heading" style={{ fontSize: "1rem" }}>Partidos en este estadio</h2>
            </div>
            <div className="match-section">
              {venue.matches
                .filter(m => m.status !== "live")
                .map(m => <MatchRow key={m.id} match={m} />)}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--muted)" }}>
            <div style={{ fontSize: "2rem", marginBottom: 8 }}>📅</div>
            <p>No hay partidos asignados a este estadio aún.</p>
          </div>
        )}
      </div>
    </div>
  )
}
