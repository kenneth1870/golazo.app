import { NavLink, Outlet } from "react-router-dom"

const TABS = [
  { path: "/mundial/teams",   label: "Teams" },
  { path: "/mundial/schedule",label: "Schedule" },
  { path: "/mundial/venues",  label: "Venues" },
  { path: "/mundial/scorers", label: "Top Scorers" },
]

export default function MundialPage() {
  return (
    <div>
      <div className="page-hero page-hero--mundial" style={{ backgroundImage: "url('/images/bg_1.jpg')" }}>
        <div className="container">
          <div className="mundial-hero-content">
            <img src="/images/SOCCER.png" alt="WC 2026" style={{ height: 60, marginBottom: 16 }} onError={e => e.target.style.display='none'} />
            <h1 className="page-hero__title">Mundial 2026</h1>
            <p className="page-hero__sub">FIFA World Cup · USA · Canada · Mexico · June 11 – July 19</p>
          </div>
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
