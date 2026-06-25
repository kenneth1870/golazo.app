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
  const venueImg = venue?.image_url || null

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

  const COUNTRY_GRADIENT = {
    "USA":    "linear-gradient(160deg, #002868 0%, #1a1a2e 40%, #6b0f1a 100%)",
    "Canada": "linear-gradient(160deg, #8b0000 0%, #1a1a2e 50%, #8b0000 100%)",
    "Mexico": "linear-gradient(160deg, #006847 0%, #1a1a2e 50%, #8b0000 100%)",
  }
  const fallbackGradient = COUNTRY_GRADIENT[venue.country] || "linear-gradient(160deg, #1a1a2e 0%, #0d0d1a 100%)"

  return (
    <div>
      {/* ── Full-bleed stadium hero ── */}
      <div style={{ position: "relative", minHeight: 300, overflow: "hidden" }}>
        {/* Background: photo or country gradient */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: fallbackGradient,
          }}
        />
        {venueImg && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url(${venueImg})`,
              backgroundSize: "cover",
              backgroundPosition: "center 30%",
              opacity: 1,
              animation: "venueImgFadeIn 0.6s ease",
            }}
          />
        )}

        {/* Dark gradient overlay — heavier at bottom for legibility */}
        <div style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(to top, rgba(6,8,16,0.97) 0%, rgba(6,8,16,0.55) 55%, rgba(6,8,16,0.25) 100%)",
        }} />

        {/* ── Content inside hero ── */}
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 300, padding: "20px 24px 28px" }}>
          {/* Top row: back + badge */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              onClick={() => navigate("/mundial/venues")}
              style={{
                background: "rgba(255,255,255,0.12)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "#fff",
                cursor: "pointer",
                fontSize: "0.8rem",
                padding: "6px 14px",
                borderRadius: 20,
                backdropFilter: "blur(8px)",
              }}
            >
              ← {t("mundial.venuesTitle")}
            </button>
            {venue.group && (
              <span style={{
                background: (isFinal || isOpening) ? "var(--accent)" : "rgba(255,255,255,0.15)",
                border: "1px solid rgba(255,255,255,0.25)",
                color: "#fff",
                fontSize: "0.68rem",
                fontWeight: 700,
                padding: "5px 12px",
                borderRadius: 20,
                backdropFilter: "blur(8px)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}>
                {venue.group}
              </span>
            )}
          </div>

          {/* Bottom: venue identity + stats */}
          <div>
            <div style={{ marginBottom: 4, fontSize: "1.5rem" }}>🏟️</div>
            <h1 style={{ fontSize: "clamp(1.4rem, 5vw, 2.2rem)", fontWeight: 900, color: "#fff", margin: "0 0 6px", lineHeight: 1.1 }}>
              {venue.name}
            </h1>
            <div style={{ color: "rgba(255,255,255,0.75)", fontSize: "0.9rem", marginBottom: 20 }}>
              {flag} {venue.city} · {venue.country}
            </div>

            {/* Stats chips */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <StatChip label={t("mundial.capacity")} value={venue.capacity?.toLocaleString()} />
              {venue.matches?.length > 0 && <StatChip label="Partidos" value={venue.matches.length} />}
              {played > 0 && <StatChip label="Jugados" value={played} color="#10b981" />}
              {upcoming > 0 && <StatChip label="Próximos" value={upcoming} color="var(--accent)" />}
            </div>
          </div>
        </div>
      </div>

      {/* ── Matches ── */}
      <div className="site-section">
        <div className="container">
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

          {venue.matches?.length > 0 ? (
            <div>
              <div className="title-section">
                <h2 className="heading" style={{ fontSize: "1rem" }}>{t("mundial.venueMatchesTitle", "Partidos en este estadio")}</h2>
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
              <p>{t("mundial.venueNoMatches", "No hay partidos asignados a este estadio aún.")}</p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes venueImgFadeIn { from { opacity: 0 } to { opacity: 1 } }
      `}</style>
    </div>
  )
}

function StatChip({ label, value, color }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.1)",
      border: "1px solid rgba(255,255,255,0.18)",
      backdropFilter: "blur(8px)",
      borderRadius: 10,
      padding: "8px 14px",
      minWidth: 72,
    }}>
      <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.6)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: "1.1rem", fontWeight: 800, color: color || "#fff" }}>
        {value}
      </div>
    </div>
  )
}
