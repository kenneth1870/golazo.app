import { NavLink, Outlet } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useLiveCount } from "../contexts/LiveContext"
import { usePageMeta } from "../hooks/usePageMeta"

export default function ScoresPage() {
  const { t } = useTranslation()
  const liveCount = useLiveCount()
  usePageMeta(
    liveCount > 0 ? `Live Scores — ${liveCount} matches live` : "Scores — World Cup 2026 & All Competitions",
    "Live scores, results and fixtures for FIFA World Cup 2026 and all football competitions worldwide."
  )

  const TABS = [
    { path: "/scores/today",    label: t("scores.tabToday",   t("time.today")),        live: liveCount > 0 },
    { path: "/scores/results",  label: t("scores.tabResults",  t("nav.results"))  },
    { path: "/scores/groups",   label: t("scores.tabGroups",   t("nav.groupStage")) },
    { path: "/scores/knockout", label: t("scores.tabBracket",  t("nav.knockout"))  },
  ]

  return (
    <div>
      <div className="tab-bar sticky-tabs">
        <div className="container">
          <div className="tab-bar__inner">
            {TABS.map(tab => (
              <NavLink
                key={tab.path}
                to={tab.path}
                className={({ isActive }) => `tab-link${isActive ? " tab-link--active" : ""}`}
              >
                {tab.live
                  ? <><span className="live-dot" style={{ marginRight: 5 }} />{tab.label}</>
                  : tab.label
                }
              </NavLink>
            ))}
          </div>
        </div>
      </div>

      <Outlet />
    </div>
  )
}
