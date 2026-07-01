import { NavLink, Outlet } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { usePageMeta } from "../hooks/usePageMeta"

export default function MundialPage() {
  const { t } = useTranslation()
  usePageMeta(
    "FIFA World Cup 2026 — Teams, Schedule & Results",
    "Complete FIFA World Cup 2026 coverage — teams, schedule, venues, top scorers and live scores from USA, Canada & Mexico."
  )

  const TABS = [
    { path: "/mundial/schedule", label: t("mundial.tabNavSchedule", t("nav.schedule")) },
    { path: "/mundial/groups",   label: t("mundial.tabNavGroups",   t("scores.groupStage")) },
    { path: "/mundial/knockout", label: t("mundial.tabNavKnockout", t("scores.knockout")) },
    { path: "/mundial/scorers",  label: t("mundial.tabNavStats",    t("nav.topScorers")) },
    { path: "/mundial/teams",    label: t("mundial.tabNavTeams",    t("nav.teams")) },
    { path: "/mundial/venues",   label: t("mundial.tabNavVenues",   t("nav.venues")) },
  ]

  return (
    <div>
      <div className="page-hero page-hero--mundial" style={{ backgroundImage: "url('/images/hero_5.jpg')" }}>
        <div className="container">
          <div className="mundial-hero-content">
            <img src="/images/SOCCER.png" alt="WC 2026" style={{ height: 60, marginBottom: 16 }} onError={e => e.target.style.display='none'} />
            <h1 className="page-hero__title">{t("nav.mundial")}</h1>
            <p className="page-hero__sub">{t("mundial.subtitle")}</p>
          </div>
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
                {tab.label}
              </NavLink>
            ))}
          </div>
        </div>
      </div>

      <Outlet />
    </div>
  )
}
