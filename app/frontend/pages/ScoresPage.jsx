import { NavLink, Outlet, useLocation } from "react-router-dom"

const TABS = [
  { path: "/scores/live",     label: "Live" },
  { path: "/scores/results",  label: "Results" },
  { path: "/scores/fixtures", label: "Fixtures" },
  { path: "/scores/groups",   label: "Group Stage" },
  { path: "/scores/knockout", label: "Knockout" },
]

export default function ScoresPage() {
  return (
    <div>
      <div className="page-hero" style={{ backgroundImage: "url('/images/bg_3.jpg')" }}>
        <div className="container">
          <h1 className="page-hero__title">Scores</h1>
          <p className="page-hero__sub">FIFA World Cup 2026</p>
        </div>
      </div>

      <div className="tab-bar sticky-tabs">
        <div className="container">
          <div className="tab-bar__inner">
            {TABS.map(t => (
              <NavLink key={t.path} to={t.path} className={({ isActive }) => `tab-link${isActive ? " tab-link--active" : ""}`}>
                {t.label}
              </NavLink>
            ))}
          </div>
        </div>
      </div>

      <Outlet />
    </div>
  )
}
