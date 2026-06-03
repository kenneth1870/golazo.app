import { NavLink, Outlet, useParams } from "react-router-dom"

const GROUPS = Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i))

export default function GroupsPage() {
  const { group } = useParams()

  return (
    <div>
      <div className="page-hero" style={{ backgroundImage: "url('/images/bg_2.jpg')" }}>
        <div className="container">
          <h1 className="page-hero__title">Groups</h1>
          <p className="page-hero__sub">FIFA World Cup 2026 — 12 Groups</p>
        </div>
      </div>

      <div className="tab-bar sticky-tabs">
        <div className="container">
          <div className="tab-bar__inner tab-bar__inner--scroll">
            {GROUPS.map(g => (
              <NavLink key={g} to={`/groups/${g}`} className={({ isActive }) => `tab-link${isActive ? " tab-link--active" : ""}`}>
                Group {g}
              </NavLink>
            ))}
          </div>
        </div>
      </div>

      <Outlet />
    </div>
  )
}
