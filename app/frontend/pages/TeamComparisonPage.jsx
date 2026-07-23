import { useState, useEffect } from "react"
import { useNavigate, useSearchParams, Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { translateTeam } from "../i18n/teamNames"
import { usePageMeta } from "../hooks/usePageMeta"
import { useAppFocus } from "../hooks/useAppFocus"
import { fetchJson } from "../utils/fetchJson"
import { loadClubTeams } from "../utils/loadClubTeams"
import { clubTeamPath, clubTeamSlug } from "../utils/clubTeamPath"

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
        <span style={{ color: homeBetter ? "var(--green)" : "var(--text)" }}>{homeVal ?? "–"}</span>
        <span style={{ color: "var(--muted)", fontSize: "0.65rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>{label}</span>
        <span style={{ color: awayBetter ? "var(--green)" : "var(--text)" }}>{awayVal ?? "–"}</span>
      </div>
      <div style={{ display: "flex", height: 6, borderRadius: 3, overflow: "hidden", background: "var(--surface2)" }}>
        <div style={{ width: `${homePct}%`, background: homeBetter ? "var(--green)" : "var(--accent)", transition: "width .5s ease" }} />
        <div style={{ width: `${awayPct}%`, background: awayBetter ? "var(--green)" : "rgba(99,102,241,.6)", transition: "width .5s ease" }} />
      </div>
    </div>
  )
}

function WcTeamPicker({ value, onChange, label }) {
  const { t, i18n } = useTranslation()
  const [teams, setTeams] = useState([])
  useEffect(() => {
    fetchJson("/api/v1/teams?competition=WC")
      .then(({ data: d, ok }) => {
        if (!ok || !d) return
        setTeams(Array.isArray(d) ? d : d.teams || [])
      })
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
          borderRadius: 8, padding: "8px 12px", color: value ? "var(--text)" : "var(--muted)",
          fontSize: "0.85rem", fontWeight: 700, cursor: "pointer",
        }}
      >
        <option value="">{t("teamComparison.selectTeam")}</option>
        {teams.map(tm => (
          <option key={tm.id} value={tm.id}>{translateTeam(tm.name, i18n.language) || tm.name}</option>
        ))}
      </select>
    </div>
  )
}

function ClubTeamPicker({ value, onChange, label }) {
  const { t, i18n } = useTranslation()
  const [teams, setTeams] = useState([])
  useEffect(() => { loadClubTeams(setTeams) }, [])

  return (
    <div style={{ flex: 1 }}>
      <label style={{ fontSize: "0.65rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".08em", display: "block", marginBottom: 4 }}>{label}</label>
      <select
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        style={{
          width: "100%", background: "var(--surface2)", border: "1px solid var(--border)",
          borderRadius: 8, padding: "8px 12px", color: value ? "var(--text)" : "var(--muted)",
          fontSize: "0.85rem", fontWeight: 700, cursor: "pointer",
        }}
      >
        <option value="">{t("teamComparison.selectTeam")}</option>
        {teams.map(tm => {
          const key = `${tm.league_code}/${clubTeamSlug(tm.name)}`
          return (
            <option key={key} value={key}>{translateTeam(tm.name, i18n.language) || tm.name}</option>
          )
        })}
      </select>
    </div>
  )
}

function parseClubKey(key) {
  if (!key) return null
  const slash = key.indexOf("/")
  if (slash <= 0) return null
  return { code: key.slice(0, slash), slug: key.slice(slash + 1) }
}

function fetchClubTeam(key) {
  const parsed = parseClubKey(key)
  if (!parsed) return Promise.resolve(null)
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
  return fetchJson(`/api/v1/club_teams/${parsed.code}/${parsed.slug}?tz=${encodeURIComponent(tz)}`)
    .then(({ data, ok, offline }) => (!ok || offline ? null : data))
    .catch(() => null)
}

function ComparisonShell({ subtitle, homePicker, awayPicker, homeId, awayId, setHomeId, setAwayId, onCompare, loading, showComparison, homeHeader, awayHeader, statsSection, extraSections }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="site-section">
      <div className="container" style={{ maxWidth: 680 }}>
        <div className="match-back-bar" style={{ marginBottom: 0 }}>
          <button onClick={() => navigate(-1)} className="btn-back" style={{ padding: "10px 0" }}>← {t("nav.back")}</button>
        </div>

        <div style={{ padding: "24px 0 16px", textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: 8 }}>⚔️</div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 900, color: "var(--text)", margin: "0 0 4px" }}>{t("teamComparison.title")}</h1>
          <p style={{ color: "var(--muted)", fontSize: "0.82rem", margin: 0 }}>{subtitle}</p>
        </div>

        <div className="team-comparison__pickers">
          {homePicker}
          <div className="team-comparison__vs">{t("status.vs")}</div>
          {awayPicker}
        </div>
        <button
          onClick={onCompare}
          disabled={!homeId || !awayId || loading}
          style={{
            width: "100%", padding: "10px", marginBottom: 24,
            background: homeId && awayId ? "var(--accent)" : "var(--surface2)",
            border: "none", borderRadius: 10, color: homeId && awayId ? "#fff" : "var(--muted)", fontWeight: 800,
            fontSize: "0.85rem", cursor: homeId && awayId ? "pointer" : "default",
            opacity: homeId && awayId ? 1 : 0.5,
          }}
        >
          {loading ? t("loading") : t("teamComparison.compare")}
        </button>

        {showComparison && (
          <>
            <div className="team-comparison__headers">
              {homeHeader}
              <div className="team-comparison__headers-vs">{t("status.vs")}</div>
              {awayHeader}
            </div>
            {statsSection}
            {extraSections}
          </>
        )}
      </div>
    </div>
  )
}

function WcTeamComparison() {
  const { t, i18n } = useTranslation()
  const [params, setParams] = useSearchParams()
  const [homeId, setHomeId] = useState(params.get("home") || "")
  const [awayId, setAwayId] = useState(params.get("away") || "")
  const [homeData, setHomeData] = useState(null)
  const [awayData, setAwayData] = useState(null)
  const [loading, setLoading] = useState(false)

  const homeName = translateTeam(homeData?.name, i18n.language) || homeData?.name || "Team A"
  const awayName = translateTeam(awayData?.name, i18n.language) || awayData?.name || "Team B"

  usePageMeta(
    homeData && awayData ? `${homeName} vs ${awayName} — Comparison` : t("teamComparison.title"),
    t("teamComparison.subtitle")
  )

  useEffect(() => {
    if (!homeId && !awayId) return
    setLoading(true)
    const fetches = []
    if (homeId) fetches.push(fetchJson(`/api/v1/teams/${homeId}`).then(({ data, ok }) => ok ? data : null).catch(() => null))
    if (awayId) fetches.push(fetchJson(`/api/v1/teams/${awayId}`).then(({ data, ok }) => ok ? data : null).catch(() => null))
    Promise.all(fetches).then(results => {
      let i = 0
      if (homeId) setHomeData(results[i++])
      if (awayId) setAwayData(results[i])
    }).finally(() => setLoading(false))
  }, [homeId, awayId])

  const hs = homeData?.tournament_stats || {}
  const as = awayData?.tournament_stats || {}

  return (
    <ComparisonShell
      subtitle={t("teamComparison.subtitle")}
      homePicker={<WcTeamPicker value={homeId} onChange={setHomeId} label={t("teamComparison.homeTeam")} />}
      awayPicker={<WcTeamPicker value={awayId} onChange={setAwayId} label={t("teamComparison.awayTeam")} />}
      homeId={homeId}
      awayId={awayId}
      setHomeId={setHomeId}
      setAwayId={setAwayId}
      onCompare={() => { if (homeId && awayId) setParams({ home: homeId, away: awayId }) }}
      loading={loading}
      showComparison={homeData && awayData}
      homeHeader={(
        <Link to={`/teams/${homeId}`} style={{ flex: 1, textDecoration: "none" }}>
          {homeData.flag_url && <img src={homeData.flag_url} alt={homeName} style={{ width: 48, height: 48, objectFit: "contain", display: "block", margin: "0 auto 6px" }} />}
          <div style={{ fontWeight: 900, fontSize: "0.95rem", color: "var(--text)" }}>{homeName}</div>
          {homeData.group && <div style={{ fontSize: "0.65rem", color: "var(--muted)" }}>{t("nav.group", { letter: homeData.group })}</div>}
        </Link>
      )}
      awayHeader={(
        <Link to={`/teams/${awayId}`} style={{ flex: 1, textDecoration: "none" }}>
          {awayData.flag_url && <img src={awayData.flag_url} alt={awayName} style={{ width: 48, height: 48, objectFit: "contain", display: "block", margin: "0 auto 6px" }} />}
          <div style={{ fontWeight: 900, fontSize: "0.95rem", color: "var(--text)" }}>{awayName}</div>
          {awayData.group && <div style={{ fontSize: "0.65rem", color: "var(--muted)" }}>{t("nav.group", { letter: awayData.group })}</div>}
        </Link>
      )}
      statsSection={(
        <div className="match-section" style={{ padding: "16px 20px", marginBottom: 16 }}>
          <h3 className="match-section__title" style={{ marginBottom: 16 }}>{t("team.tournamentStats")}</h3>
          <StatBar label={t("team.goalsScored")} homeVal={hs.goals_for ?? 0} awayVal={as.goals_for ?? 0} />
          <StatBar label={t("team.goalsConceded")} homeVal={hs.goals_against ?? 0} awayVal={as.goals_against ?? 0} invert />
          <StatBar label={t("teamComparison.wins")} homeVal={hs.won ?? 0} awayVal={as.won ?? 0} />
          <StatBar label={t("teamComparison.draws")} homeVal={hs.drawn ?? 0} awayVal={as.drawn ?? 0} />
          <StatBar label={t("teamComparison.losses")} homeVal={hs.lost ?? 0} awayVal={as.lost ?? 0} invert />
          <StatBar label={t("table.points")} homeVal={hs.points ?? 0} awayVal={as.points ?? 0} />
          {hs.shots_total != null && <StatBar label={t("match.statShots")} homeVal={hs.shots_total} awayVal={as.shots_total} />}
          {hs.possession != null && <StatBar label={t("teamComparison.avgPossession")} homeVal={hs.possession} awayVal={as.possession} />}
        </div>
      )}
      extraSections={(homeData.scorers?.length > 0 || awayData.scorers?.length > 0) && (
        <div className="match-section" style={{ padding: "16px 20px", marginBottom: 16 }}>
          <h3 className="match-section__title" style={{ marginBottom: 12 }}>{t("team.topScorers")}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[homeData, awayData].map((team, ti) => (
              <div key={ti}>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".08em", color: "var(--muted)", marginBottom: 8 }}>
                  {ti === 0 ? homeName : awayName}
                </div>
                {(team.scorers || []).slice(0, 3).map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.player_name}</span>
                    <span style={{ fontWeight: 900, color: "var(--accent)", fontSize: "0.85rem" }}>⚽ {s.goals}</span>
                  </div>
                ))}
                {!team.scorers?.length && <div style={{ color: "var(--muted)", fontSize: "0.75rem" }}>{t("mundial.noScorers")}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    />
  )
}

function ClubTeamComparison() {
  const { t, i18n } = useTranslation()
  const [params, setParams] = useSearchParams()
  const [homeKey, setHomeKey] = useState(params.get("home") || "")
  const [awayKey, setAwayKey] = useState(params.get("away") || "")
  const [homeData, setHomeData] = useState(null)
  const [awayData, setAwayData] = useState(null)
  const [loading, setLoading] = useState(false)

  const homeName = translateTeam(homeData?.team?.name, i18n.language) || homeData?.team?.name || "Team A"
  const awayName = translateTeam(awayData?.team?.name, i18n.language) || awayData?.team?.name || "Team B"

  usePageMeta(
    homeData && awayData ? `${homeName} vs ${awayName} — Comparison` : t("teamComparison.title"),
    t("teamComparison.subtitleClubs")
  )

  useEffect(() => {
    if (!homeKey && !awayKey) return
    setLoading(true)
    Promise.all([
      homeKey ? fetchClubTeam(homeKey) : Promise.resolve(null),
      awayKey ? fetchClubTeam(awayKey) : Promise.resolve(null),
    ]).then(([hd, ad]) => {
      if (homeKey) setHomeData(hd)
      if (awayKey) setAwayData(ad)
    }).finally(() => setLoading(false))
  }, [homeKey, awayKey])

  const hs = homeData?.standing || {}
  const as = awayData?.standing || {}

  const teamLink = (data, key) => {
    const parsed = parseClubKey(key)
    if (!data?.team || !parsed) return null
    return (
      <Link to={clubTeamPath(parsed.code, parsed.slug)} style={{ flex: 1, textDecoration: "none" }}>
        {data.team.flag_url && <img src={data.team.flag_url} alt={data.team.name} style={{ width: 48, height: 48, objectFit: "contain", display: "block", margin: "0 auto 6px" }} />}
        <div style={{ fontWeight: 900, fontSize: "0.95rem", color: "var(--text)" }}>{translateTeam(data.team.name, i18n.language) || data.team.name}</div>
        {data.standing?.rank != null && (
          <div style={{ fontSize: "0.65rem", color: "var(--muted)" }}>#{data.standing.rank}</div>
        )}
      </Link>
    )
  }

  return (
    <ComparisonShell
      subtitle={t("teamComparison.subtitleClubs")}
      homePicker={<ClubTeamPicker value={homeKey} onChange={setHomeKey} label={t("teamComparison.homeTeam")} />}
      awayPicker={<ClubTeamPicker value={awayKey} onChange={setAwayKey} label={t("teamComparison.awayTeam")} />}
      homeId={homeKey}
      awayId={awayKey}
      setHomeId={setHomeKey}
      setAwayId={setAwayKey}
      onCompare={() => { if (homeKey && awayKey) setParams({ home: homeKey, away: awayKey }) }}
      loading={loading}
      showComparison={homeData?.team && awayData?.team}
      homeHeader={teamLink(homeData, homeKey)}
      awayHeader={teamLink(awayData, awayKey)}
      statsSection={(
        <div className="match-section" style={{ padding: "16px 20px", marginBottom: 16 }}>
          <h3 className="match-section__title" style={{ marginBottom: 16 }}>{t("nav.standings")}</h3>
          <StatBar label={t("table.pos")} homeVal={hs.rank ?? "–"} awayVal={as.rank ?? "–"} invert />
          <StatBar label={t("team.goalsScored")} homeVal={hs.goals_for ?? 0} awayVal={as.goals_for ?? 0} />
          <StatBar label={t("team.goalsConceded")} homeVal={hs.goals_against ?? 0} awayVal={as.goals_against ?? 0} invert />
          <StatBar label={t("teamComparison.wins")} homeVal={hs.won ?? 0} awayVal={as.won ?? 0} />
          <StatBar label={t("teamComparison.draws")} homeVal={hs.drawn ?? 0} awayVal={as.drawn ?? 0} />
          <StatBar label={t("teamComparison.losses")} homeVal={hs.lost ?? 0} awayVal={as.lost ?? 0} invert />
          <StatBar label={t("table.gd")} homeVal={hs.goal_diff ?? 0} awayVal={as.goal_diff ?? 0} />
          <StatBar label={t("table.points")} homeVal={hs.points ?? 0} awayVal={as.points ?? 0} />
        </div>
      )}
    />
  )
}

export default function TeamComparisonPage() {
  const { clubs_primary: clubsPrimary } = useAppFocus()
  return clubsPrimary ? <ClubTeamComparison /> : <WcTeamComparison />
}
