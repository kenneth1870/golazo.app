import { Link } from "react-router-dom"
import { translateTeam } from "../i18n/teamNames"

export function rowQualStyle(rank, rows) {
  const complete = rows.length > 0 && rows.every(r => (r.played ?? 0) >= 3)
  const alpha    = complete ? 1 : 0.45
  if (rank === 0) return { background: `rgba(16,185,129,${0.12 * alpha})`, borderLeft: `2px solid rgba(16,185,129,${alpha})` }
  if (rank === 1) return { background: `rgba(16,185,129,${0.07 * alpha})`, borderLeft: `2px solid rgba(16,185,129,${alpha * 0.6})` }
  if (rank === 2) return { background: `rgba(245,158,11,${0.07 * alpha})`, borderLeft: `2px solid rgba(245,158,11,${alpha * 0.5})` }
  return { background: `rgba(239,68,68,${0.05 * alpha})`, borderLeft: "2px solid transparent" }
}

function rankColor(i) {
  return i === 0 || i === 1 ? "#10b981" : i === 2 ? "#f59e0b" : "#666"
}

function goalDiff(s) {
  if (s.goal_diff != null) return s.goal_diff
  if (s.goals_for != null) return (s.goals_for ?? 0) - (s.goals_against ?? 0)
  return null
}

function TeamCell({ s, lang, linkTeam = true }) {
  const name = translateTeam(s.team?.name, lang)
  const inner = (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      {s.team?.flag_url && (
        <img src={s.team.flag_url} alt={s.team.name} className="flag-xs" loading="eager"
          onError={e => (e.target.style.display = "none")} />
      )}
      <span style={{ fontWeight: 700, color: "var(--text)" }}>{name}</span>
    </div>
  )
  if (linkTeam && s.team?.id) {
    return <Link to={`/teams/${s.team.id}`} style={{ color: "inherit", textDecoration: "none" }}>{inner}</Link>
  }
  return inner
}

export function GroupStandingsCards({ rows, t, lang, linkTeam = true }) {
  if (!rows?.length) return null
  return (
    <div className="standings-cards d-md-none">
      {rows.map((s, i) => {
        const gd = goalDiff(s)
        const rc = rankColor(i)
        return (
          <div
            key={s.team?.id ?? i}
            className="standings-card"
            style={rowQualStyle(i, rows)}
          >
            <div className="standings-card__rank" style={{ color: rc }}>{s.rank ?? i + 1}</div>
            <div className="standings-card__team">
              <TeamCell s={s} lang={lang} linkTeam={linkTeam} />
            </div>
            <div className="standings-card__stats">
              <span className="standings-card__pts">
                <strong>{s.points ?? 0}</strong> {t("table.points")}
              </span>
              {gd != null && (
                <span className="standings-card__gd" style={{ color: gd > 0 ? "#10b981" : gd < 0 ? "#ef4444" : "var(--muted)" }}>
                  {gd > 0 ? `+${gd}` : gd} {t("table.gd")}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function GroupStandingsFullTable({ rows, t, lang, linkTeam = true, minWidth = 320 }) {
  if (!rows?.length) {
    return (
      <div style={{ textAlign: "center", padding: "2rem" }}>
        <div style={{ fontSize: "1.5rem", marginBottom: 8, opacity: .3 }}>🏆</div>
        <div style={{ color: "var(--muted)", fontSize: "0.82rem" }}>{t("groups.noStandingsYet")}</div>
      </div>
    )
  }
  return (
    <>
      <div className="d-none d-md-block table-responsive">
        <table className="table custom-table mb-0">
          <thead>
            <tr>
              <th>{t("table.pos")}</th>
              <th>{t("table.team")}</th>
              <th>{t("table.played")}</th>
              <th>{t("table.won")}</th>
              <th>{t("table.drawn")}</th>
              <th>{t("table.lost")}</th>
              <th>{t("table.gf")}</th>
              <th>{t("table.ga")}</th>
              <th>{t("table.gd")}</th>
              <th>{t("table.points")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => {
              const gd = goalDiff(s)
              const rc = rankColor(i)
              return (
                <tr key={s.team?.id ?? i} style={rowQualStyle(i, rows)}>
                  <td style={{ color: rc, fontWeight: 700 }}>{s.rank ?? i + 1}</td>
                  <td><TeamCell s={s} lang={lang} linkTeam={linkTeam} /></td>
                  <td>{s.played ?? 0}</td>
                  <td>{s.won ?? 0}</td>
                  <td>{s.drawn ?? 0}</td>
                  <td>{s.lost ?? 0}</td>
                  <td>{s.goals_for ?? s.gf ?? "–"}</td>
                  <td>{s.goals_against ?? s.ga ?? "–"}</td>
                  <td style={{ color: gd > 0 ? "#10b981" : gd < 0 ? "#ef4444" : "inherit" }}>
                    {gd != null ? (gd > 0 ? `+${gd}` : gd) : "–"}
                  </td>
                  <td><strong style={{ color: "var(--text)" }}>{s.points ?? 0}</strong></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <GroupStandingsCards rows={rows} t={t} lang={lang} linkTeam={linkTeam} />
    </>
  )
}

/** Compact table for group-stage widgets — cards on mobile. */
export function GroupStandingsCompact({ rows, t, lang }) {
  if (!rows?.length) return null
  return (
    <>
      <div className="d-none d-md-block">
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem", minWidth: 260 }}>
          <thead>
            <tr style={{ color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".05em" }}>
              <th style={{ textAlign: "left", padding: "3px 6px", fontWeight: 600 }}>{t("table.team")}</th>
              <th style={{ textAlign: "center", padding: "3px 4px", fontWeight: 600 }}>{t("table.played")}</th>
              <th style={{ textAlign: "center", padding: "3px 4px", fontWeight: 600 }}>{t("table.won")}</th>
              <th style={{ textAlign: "center", padding: "3px 4px", fontWeight: 600 }}>{t("table.drawn")}</th>
              <th style={{ textAlign: "center", padding: "3px 4px", fontWeight: 600 }}>{t("table.lost")}</th>
              <th style={{ textAlign: "center", padding: "3px 4px", fontWeight: 600 }}>{t("table.gd")}</th>
              <th style={{ textAlign: "center", padding: "3px 4px", fontWeight: 700, color: "var(--accent)" }}>{t("table.points")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => {
              const gd = goalDiff(s) ?? 0
              return (
                <tr key={s.team?.id ?? i} style={{ borderTop: "1px solid var(--border)", ...rowQualStyle(i, rows) }}>
                  <td style={{ padding: "5px 6px" }}>
                    <TeamCell s={s} lang={lang} linkTeam />
                  </td>
                  <td style={{ textAlign: "center", padding: "5px 4px", color: "var(--muted)" }}>{s.played ?? 0}</td>
                  <td style={{ textAlign: "center", padding: "5px 4px", color: "var(--muted)" }}>{s.won ?? 0}</td>
                  <td style={{ textAlign: "center", padding: "5px 4px", color: "var(--muted)" }}>{s.drawn ?? 0}</td>
                  <td style={{ textAlign: "center", padding: "5px 4px", color: "var(--muted)" }}>{s.lost ?? 0}</td>
                  <td style={{ textAlign: "center", padding: "5px 4px", color: "var(--muted)" }}>
                    {gd > 0 ? `+${gd}` : gd}
                  </td>
                  <td style={{ textAlign: "center", padding: "5px 4px", fontWeight: 800, color: "var(--text)" }}>{s.points ?? 0}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <GroupStandingsCards rows={rows} t={t} lang={lang} linkTeam />
    </>
  )
}
