import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { usePageMeta } from "../../hooks/usePageMeta"
import { useStandingsChannel } from "../../hooks/useStandingsChannel"
import { translateTeam } from "../../i18n/teamNames"

const MEDALS = ["🥇", "🥈", "🥉"]
const RANK_COLORS = ["#f59e0b", "#94a3b8", "#cd7f32"]

const TAB_DEFS = [
  { key: "goals",   labelKey: "mundial.tabGoals",   unitKey: "mundial.unitGoals",   icon: "⚽", endpoint: "/api/v1/top_scorers?competition=WC",           valueKey: "goals"        },
  { key: "assists", labelKey: "mundial.tabAssists",  unitKey: "mundial.unitAssists", icon: "🎯", endpoint: "/api/v1/top_assists?competition=WC",            valueKey: "assists"      },
  { key: "yellow",  labelKey: "mundial.tabYellow",   unitKey: "mundial.unitYellow",  icon: "🟨", endpoint: "/api/v1/top_cards?competition=WC&type=yellow",  valueKey: "yellow_cards" },
  { key: "red",     labelKey: "mundial.tabRed",      unitKey: "mundial.unitRed",     icon: "🟥", endpoint: "/api/v1/top_cards?competition=WC&type=red",     valueKey: "red_cards"    },
]

// ─── Leader hero card ──────────────────────────────────
function LeaderHero({ player, tab, lang }) {
  const { t } = useTranslation()
  if (!player) return null
  const value    = player[tab.valueKey] ?? 0
  const teamName = translateTeam(player.team?.name, lang)
  const barColor = tab.key === "yellow" ? "#f59e0b" : tab.key === "red" ? "#ef4444" : tab.key === "assists" ? "#3b82f6" : "#f59e0b"

  return (
    <div style={{
      background: `linear-gradient(135deg, ${barColor}1e 0%, rgba(238,30,70,.08) 100%)`,
      border: `1px solid ${barColor}59`,
      borderRadius: 16, padding: "20px 24px", marginBottom: 20,
      display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
    }}>
      <div style={{ textAlign: "center", flexShrink: 0 }}>
        <div style={{ fontSize: "2.8rem", lineHeight: 1 }}>{tab.icon}</div>
        <div style={{ fontSize: "0.6rem", fontWeight: 800, letterSpacing: ".12em", color: barColor, textTransform: "uppercase", marginTop: 4 }}>
          {t("mundial.leader")}
        </div>
      </div>

      {player.team?.crest && (
        <img src={player.team.crest} alt={teamName} style={{ width: 56, height: 56, objectFit: "contain", flexShrink: 0 }}
          onError={e => (e.target.style.display = "none")} />
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.72rem", color: "var(--muted)", marginBottom: 2 }}>{teamName}</div>
        {player.player?.id ? (
          <Link to={`/players/${player.player.id}?league=1&season=2026`}
            style={{ color: "#fff", fontWeight: 900, fontSize: "1.2rem", textDecoration: "none", display: "block" }}>
            {player.player?.name}
          </Link>
        ) : (
          <div style={{ color: "#fff", fontWeight: 900, fontSize: "1.2rem" }}>{player.player?.name}</div>
        )}
        <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: 2 }}>
          {player.played ?? 0} {t("mundial.matchesPlayed")}
        </div>
      </div>

      <div style={{ textAlign: "center", flexShrink: 0 }}>
        <div style={{ fontSize: "3rem", fontWeight: 900, color: barColor, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: "0.62rem", fontWeight: 700, color: "var(--muted)", letterSpacing: ".1em", textTransform: "uppercase" }}>
          {tab.unit}
        </div>
      </div>
    </div>
  )
}

// ─── Single row ───────────────────────────────────────
function PlayerRow({ player, rank, maxValue, tab, lang }) {
  const value     = player[tab.valueKey] ?? 0
  const pct       = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0
  const teamName  = translateTeam(player.team?.name, lang)
  const medal     = MEDALS[rank]
  const rankColor = RANK_COLORS[rank]
  const barColor  = tab.key === "yellow" ? "#f59e0b" : tab.key === "red" ? "#ef4444" : rank === 0 ? "linear-gradient(90deg,#f59e0b,#ee1e46)" : "#3b82f6"

  return (
    <div style={{
      padding: "14px 20px", borderBottom: "1px solid var(--border)",
      display: "grid", gridTemplateColumns: "28px 1fr auto", gap: 12, alignItems: "center",
    }}>
      <div style={{ textAlign: "center", fontWeight: 800, fontSize: "0.85rem", color: rankColor ?? "var(--muted)" }}>
        {medal ?? rank + 1}
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
          {player.team?.crest && (
            <img src={player.team.crest} alt="" style={{ width: 18, height: 18, objectFit: "contain", flexShrink: 0 }}
              onError={e => (e.target.style.display = "none")} />
          )}
          {player.player?.id ? (
            <Link to={`/players/${player.player.id}?league=1&season=2026`}
              style={{ color: "#fff", fontWeight: 700, fontSize: "0.88rem", textDecoration: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {player.player?.name}
            </Link>
          ) : (
            <span style={{ color: "#fff", fontWeight: 700, fontSize: "0.88rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {player.player?.name}
            </span>
          )}
          <span style={{ fontSize: "0.7rem", color: "var(--muted)", flexShrink: 0 }}>{teamName}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, height: 5, borderRadius: 3, background: "var(--surface2)", overflow: "hidden" }}>
            <div style={{
              width: `${pct}%`, height: "100%",
              background: barColor, borderRadius: 3, transition: "width .5s ease",
            }} />
          </div>
          {tab.key === "goals" && (
            <span style={{ fontSize: "0.65rem", color: "var(--muted)", flexShrink: 0, minWidth: 28, textAlign: "right" }}>
              {player.assists ?? 0} ast
            </span>
          )}
        </div>
      </div>

      <div style={{ textAlign: "right" }}>
        <span style={{ fontSize: "1.25rem", fontWeight: 900, color: rank === 0 ? barColor : "#fff" }}>
          {value}
        </span>
        <div style={{ fontSize: "0.6rem", color: "var(--muted)" }}>{tab.unit}</div>
      </div>
    </div>
  )
}

// 5-minute TTL so stale empty results don't persist across navigations
const CACHE_TTL = 5 * 60 * 1000
const cache = {} // key → { rows, ts }

export default function ScorersPage() {
  const { t, i18n } = useTranslation()
  usePageMeta(t("mundial.scorersTitle"), "Top scorers, assists and discipline at FIFA World Cup 2026.")
  const [activeTab, setActiveTab] = useState("goals")
  const [data, setData]           = useState({})
  const [loading, setLoading]     = useState(false)

  const TABS = TAB_DEFS.map(d => ({ ...d, label: t(d.labelKey), unit: t(d.unitKey) }))
  const tab = TABS.find(tab => tab.key === activeTab)

  const fetchTab = useCallback((tabKey) => {
    const t = TABS.find(t => t.key === tabKey)
    if (!t) return
    setLoading(true)
    fetch(t.endpoint)
      .then(r => r.json())
      .then(rows => {
        cache[tabKey] = { rows, ts: Date.now() }
        setData(prev => ({ ...prev, [tabKey]: rows }))
      })
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const cached = cache[activeTab]
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setData(prev => ({ ...prev, [activeTab]: cached.rows }))
      return
    }
    fetchTab(activeTab)
  }, [activeTab, fetchTab])

  // Refresh when a match finishes (standings_updated fires from RecalculateStandingsJob)
  useStandingsChannel(() => {
    Object.keys(cache).forEach(k => delete cache[k])
    fetchTab(activeTab)
  })

  const rows     = (data[activeTab] || []).filter(p => (p[tab.valueKey] ?? 0) > 0)
  const leader   = rows[0]
  const maxValue = leader?.[tab.valueKey] ?? 1
  const rest     = rows.slice(1)

  return (
    <div className="site-section">
      <div className="container">

        {/* Sub-tab bar */}
        <div style={{ display: "flex", gap: 6, marginBottom: 20, overflowX: "auto", paddingBottom: 2 }}>
          {TABS.map(tb => (
            <button
              key={tb.key}
              onClick={() => setActiveTab(tb.key)}
              style={{
                padding: "7px 14px", borderRadius: 20, border: "1px solid var(--border)",
                background: activeTab === tb.key ? "var(--accent)" : "var(--surface2)",
                color: activeTab === tb.key ? "#fff" : "var(--muted)",
                fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", whiteSpace: "nowrap",
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {tb.icon} {tb.label}
            </button>
          ))}
        </div>

        {loading && (
          <>
            <div className="loading-shimmer" style={{ height: 140, borderRadius: 16, marginBottom: 16 }} />
            {[...Array(8)].map((_, i) => (
              <div key={i} className="loading-shimmer" style={{ height: 68, borderRadius: 8, marginBottom: 8 }} />
            ))}
          </>
        )}

        {!loading && rows.length === 0 && (
          <div className="empty-state">
            <div className="empty-state__icon">{tab.icon}</div>
            <h3>{t("mundial.noData")}</h3>
            <p>{t("mundial.appearsWhenPlayed")}</p>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <>
            <LeaderHero player={leader} tab={tab} lang={i18n.language} />
            <div className="widget-next-match" style={{ overflow: "hidden" }}>
              {rest.map((p, i) => (
                <PlayerRow key={p.player?.id ?? i} player={p} rank={i + 1} maxValue={maxValue} tab={tab} lang={i18n.language} />
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  )
}
