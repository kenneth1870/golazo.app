import { NavLink, Outlet } from "react-router-dom"
import { useTranslation } from "react-i18next"

const GROUPS = Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i))

export default function GroupsPage() {
  const { t } = useTranslation()
  return (
    <div>
      <div className="page-hero" style={{ backgroundImage: "url('/images/bg_2.jpg')" }}>
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
