import { NavLink, Outlet } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useLiveCount } from "../contexts/LiveContext"

export default function ScoresPage() {
  const { t } = useTranslation()
  const liveCount = useLiveCount()

  const TABS = [
    { path: "/scores/today",    label: t("time.today"), live: liveCount > 0 },
    { path: "/scores/results",  label: t("nav.results")    },
    { path: "/scores/fixtures", label: t("nav.fixtures")   },
    { path: "/scores/groups",   label: t("nav.groupStage") },
    { path: "/scores/knockout", label: t("nav.knockout")   },
  ]

  return (
    <div>
      <div className="page-hero" style={{ backgroundImage: "url('/images/bg_3.jpg')" }}>
        <div className="container">
          <h1 className="page-hero__title">{t("nav.scores")}</h1>
          <p className="page-hero__sub">{t("scores.wcSubtitle")}</p>
        </div>
      </div>

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
