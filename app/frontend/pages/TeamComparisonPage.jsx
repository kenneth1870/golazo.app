import { useState, useEffect } from "react"
import { useNavigate, useSearchParams, Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { translateTeam } from "../i18n/teamNames"
import { usePageMeta } from "../hooks/usePageMeta"

function StatBar({ label, homeVal, awayVal, invert = false }) {
  const hv = parseFloat(homeVal) || 0
  const av = parseFloat(awayVal) || 0
  const total = hv + av || 1
  const homePct = (hv / total) * 100
  const awayPct = (av / total) * 100
  const homeBetter = invert ? hv < av : hv > av
  const awayBetter = invert ? av < hv : av > hv

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", marginBottom: 4, fontWeight: 700 }}>
        <span style={{ color: homeBetter ? "#10b981" : "#fff" }}>{homeVal ?? "–"}</span>
        <span style={{ color: "var(--muted)", fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</span>
        <span style={{ color: awayBetter ? "#10b981" : "#fff" }}>{awayVal ?? "–"}</span>
      </div>
      <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: "var(--surface2)" }}>
        <div style={{ width: `${homePct}%`, background: homeBetter ? "#10b981" : "#ee1e46", transition: "width .5s ease" }} />
        <div style={{ width: `${awayPct}%`, background: awayBetter ? "#10b981" : "rgba(99,102,241,.6)", transition: "width .5s ease" }} />
      </div>
    </div>
  )
}

function TeamPicker({ value, onChange, label }) {
  const { i18n } = useTranslation()
  const [teams, setTeams] = useState([])
  useEffect(() => {
    fetch("/api/v1/teams?competition=WC")
      .then(r => r.json())
      .then(d => setTeams(Array.isArray(d) ? d : d.teams || []))
      .catch(() => {})
  }, [])

  return (
    <div style={{ flex: 1 }}>
      <label style={{ fontSize: "0.65rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em", display: "block", marginBottom: 4 }}>{label}</label>
      <select
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        style={{
          width: "100%", background: "var(--surface2)", border: "1px solid var(--border)",
          borderRadius: 8, padding: "8px 12px", color: value ? "#fff" : "var(--muted)",
          fontSize: "0.85rem", fontWeight: 700, cursor: "pointer",
        }}
      >
        <option value="">Select team…</option>
        {teams.map(t => (
          <option key={t.id} value={t.id}>{translateTeam(t.name, i18n.language) || t.name}</option>
        ))}
      </select>
    </div>
  )
}

export default function TeamComparisonPage() {
  const { t, i18n } = useTranslation()
  const navigate     = useNavigate()
  const [params, setParams] = useSearchParams()

  const [homeId, setHomeId] = useState(params.get("home") || "")
  const [awayId, setAwayId] = useState(params.get("away") || "")
  const [homeData, setHomeData] = useState(null)
  const [awayData, setAwayData] = useState(null)
  const [loading, setLoading]   = useState(false)

  const homeName = translateTeam(homeData?.name, i18n.language) || homeData?.name || "Team A"
  const awayName = translateTeam(awayData?.name, i18n.language) || awayData?.name || "Team B"

  usePageMeta(
    homeData && awayData ? `${homeName} vs ${awayName} — Comparison` : "Team Comparison",
    "Compare World Cup 2026 team stats side by side."
  )

  useEffect(() => {
    if (!homeId && !awayId) return
    setLoading(true)
    const fetches = []
    if (homeId) fetches.push(fetch(`/api/v1/teams/${homeId}`).then(r => r.json()).catch(() => null))
    if (awayId) fetches.push(fetch(`/api/v1/teams/${awayId}`).then(r => r.json()).catch(() => null))
    Promise.all(fetches).then(([hd, ad]) => {
      if (homeId) setHomeData(hd)
      if (awayId) setAwayData(ad)
    }).finally(() => setLoading(false))
  }, [homeId, awayId])

  const compare = () => {
    if (homeId && awayId) setParams({ home: homeId, away: awayId })
  }

  const hs = homeData?.tournament_stats || {}
  const as = awayData?.tournament_stats || {}

  const showComparison = homeData && awayData

  return (
    <div className="site-section">
      <div className="container" style={{ maxWidth: 680 }}>
        <div className="match-back-bar" style={{ marginBottom: 0 }}>
          <button onClick={() => navigate(-1)} className="btn-back" style={{ padding: "10px 0" }}>← {t("nav.back")}</button>
        </div>

        <div style={{ padding: "24px 0 16px", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>⚔️</div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 900, color: "#fff", margin: "0 0 4px" }}>Team Comparison</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: 0 }}>Compare two World Cup 2026 teams side by side</p>
        </div>

        {/* Team pickers */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 16 }}>
          <TeamPicker value={homeId} onChange={setHomeId} label="Home Team" />
          <div style={{ fontSize: "1.1rem", paddingBottom: 10, color: "var(--muted)" }}>vs</div>
          <TeamPicker value={awayId} onChange={setAwayId} label="Away Team" />
        </div>
        <button
          onClick={compare}
          disabled={!homeId || !awayId || loading}
          style={{
            width: "100%", padding: "10px", marginBottom: 24,
            background: homeId && awayId ? "#ee1e46" : "var(--surface2)",
            border: "none", borderRadius: 10, color: "#fff", fontWeight: 800,
            fontSize: "0.85rem", cursor: homeId && awayId ? "pointer" : "default",
            opacity: homeId && awayId ? 1 : 0.5,
          }}
        >
          {loading ? "Loading…" : "Compare"}
        </button>

        {showComparison && (
          <>
            {/* Team headers */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, textAlign: "center" }}>
              <Link to={`/teams/${homeId}`} style={{ flex: 1, textDecoration: "none" }}>
                {homeData.flag_url && <img src={homeData.flag_url} alt="" style={{ width: 48, height: 48, objectFit: "contain", display: "block", margin: "0 auto 6px" }} />}
                <div style={{ fontWeight: 900, fontSize: "0.95rem", color: "#fff" }}>{homeName}</div>
                {homeData.group && <div style={{ fontSize: "0.65rem", color: "var(--muted)" }}>Group {homeData.group}</div>}
              </Link>
              <div style={{ fontWeight: 900, fontSize: "1.2rem", color: "var(--muted)" }}>vs</div>
              <Link to={`/teams/${awayId}`} style={{ flex: 1, textDecoration: "none" }}>
                {awayData.flag_url && <img src={awayData.flag_url} alt="" style={{ width: 48, height: 48, objectFit: "contain", display: "block", margin: "0 auto 6px" }} />}
                <div style={{ fontWeight: 900, fontSize: "0.95rem", color: "#fff" }}>{awayName}</div>
                {awayData.group && <div style={{ fontSize: "0.65rem", color: "var(--muted)" }}>Group {awayData.group}</div>}
              </Link>
            </div>

            {/* Tournament stats */}
            <div className="match-section" style={{ padding: "16px 20px", marginBottom: 16 }}>
              <h3 className="match-section__title" style={{ marginBottom: 16 }}>Tournament Stats</h3>
              <StatBar label="Goals Scored"   homeVal={hs.goals_for    ?? 0} awayVal={as.goals_for    ?? 0} />
              <StatBar label="Goals Conceded" homeVal={hs.goals_against ?? 0} awayVal={as.goals_against ?? 0} invert />
              <StatBar label="Wins"           homeVal={hs.won          ?? 0} awayVal={as.won          ?? 0} />
              <StatBar label="Draws"          homeVal={hs.drawn        ?? 0} awayVal={as.drawn        ?? 0} />
              <StatBar label="Losses"         homeVal={hs.lost         ?? 0} awayVal={as.lost         ?? 0} invert />
              <StatBar label="Points"         homeVal={hs.points       ?? 0} awayVal={as.points       ?? 0} />
              {hs.shots_total != null && <StatBar label="Shots" homeVal={hs.shots_total} awayVal={as.shots_total} />}
              {hs.possession != null  && <StatBar label="Avg Possession %" homeVal={hs.possession} awayVal={as.possession} />}
            </div>

            {/* Top scorers */}
            {(homeData.scorers?.length > 0 || awayData.scorers?.length > 0) && (
              <div className="match-section" style={{ padding: "16px 20px", marginBottom: 16 }}>
                <h3 className="match-section__title" style={{ marginBottom: 12 }}>Top Scorers</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {[homeData, awayData].map((team, ti) => (
                    <div key={ti}>
                      <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)", marginBottom: 8 }}>
                        {ti === 0 ? homeName : awayName}
                      </div>
                      {(team.scorers || []).slice(0, 3).map((s, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#fff", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.player_name}</span>
                          <span style={{ fontWeight: 900, color: "#ee1e46", fontSize: "0.85rem" }}>⚽ {s.goals}</span>
                        </div>
                      ))}
                      {!team.scorers?.length && <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>No scorers yet</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
