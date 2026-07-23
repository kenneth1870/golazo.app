import { NavLink, Outlet } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useLiveCount } from "../contexts/LiveContext"
import { usePageMeta } from "../hooks/usePageMeta"
import { useAppFocus } from "../hooks/useAppFocus"

export default function ScoresPage() {
  const { t } = useTranslation()
  const liveCount = useLiveCount()
  const { clubs_primary: clubsPrimary } = useAppFocus()

  usePageMeta(
    liveCount > 0
      ? t("scores.metaTitleLive", { count: liveCount })
      : clubsPrimary
        ? t("scores.metaTitle")
        : t("scores.metaTitleWC"),
    clubsPrimary
      ? t("scores.metaDesc")
      : t("scores.metaDescWC")
  )

  const TABS = [
    { path: "/scores/today",    label: t("scores.tabToday",   t("time.today")),        live: liveCount > 0 },
    { path: "/scores/results",  label: t("scores.tabResults",  t("nav.results"))  },
    ...(!clubsPrimary ? [
      { path: "/mundial/groups",   label: t("scores.tabGroups",   t("nav.groupStage")) },
      { path: "/mundial/knockout", label: t("scores.tabBracket",  t("nav.knockout"))  },
    ] : []),
  ]

  return (
    <div>
      <div className="tab-bar sticky-tabs">
        <div className="container">
          <div className="tab-bar__inner tab-bar__inner--scroll">
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
