import { NavLink, Outlet } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { usePageMeta } from "../hooks/usePageMeta"

const GROUPS = Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i))

export default function GroupsPage() {
  const { t } = useTranslation()
  usePageMeta(
    "Group Stage — World Cup 2026",
    "FIFA World Cup 2026 group stage standings, results and fixtures for all 12 groups."
  )
  return (
    <div>
      <div className="page-hero" style={{ backgroundImage: "url('/images/hero_5.jpg')" }}>
        <div className="container">
          <h1 className="page-hero__title">{t("groups.title")}</h1>
          <p className="page-hero__sub">{t("groups.subtitle")}</p>
        </div>
      </div>

      <div className="tab-bar sticky-tabs">
        <div className="container">
          <div className="tab-bar__inner tab-bar__inner--scroll">
            <NavLink to="/groups" end className={({ isActive }) => `tab-link${isActive ? " tab-link--active" : ""}`}>
              {t("nav.allGroups")}
            </NavLink>
            {GROUPS.map(g => (
              <NavLink key={g} to={`/groups/${g}`} className={({ isActive }) => `tab-link${isActive ? " tab-link--active" : ""}`}>
                {g}
              </NavLink>
            ))}
          </div>
        </div>
      </div>

      <Outlet />
    </div>
  )
}
