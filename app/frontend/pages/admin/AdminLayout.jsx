import { NavLink, Outlet, useNavigate } from "react-router-dom"
import { useAuthContext } from "../../contexts/AuthContext"

const NAV = [
  { to: "/admin",         icon: "📊", label: "Dashboard",   end: true },
  { to: "/admin/matches", icon: "⚽", label: "Matches"  },
  { to: "/admin/push",    icon: "🔔", label: "Push"     },
  { to: "/admin/users",   icon: "👥", label: "Users"    },
  { to: "/admin/news",    icon: "📰", label: "News"     },
]

const S = {
  wrap:    { display: "flex", minHeight: "100vh", background: "#0d1117" },
  sidebar: {
    width: 220, background: "#111827", borderRight: "1px solid rgba(255,255,255,.06)",
    display: "flex", flexDirection: "column", padding: "24px 0", flexShrink: 0,
    position: "sticky", top: 0, height: "100vh", overflowY: "auto",
  },
  brand: {
    padding: "0 20px 24px", borderBottom: "1px solid rgba(255,255,255,.06)",
    marginBottom: 12,
  },
  brandTitle: { color: "#fff", fontWeight: 800, fontSize: "1.1rem", margin: 0 },
  brandSub:   { color: "rgba(255,255,255,.3)", fontSize: "0.72rem" },
  navLink: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "9px 20px", color: "rgba(255,255,255,.5)",
    textDecoration: "none", fontSize: "0.88rem", fontWeight: 500,
    borderRadius: 0, transition: "all .15s",
  },
  main:   { flex: 1, overflowX: "auto", padding: "32px 28px" },
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginBottom: 28,
  },
}

export default function AdminLayout() {
  const { user, logout } = useAuthContext()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate("/login")
  }

  return (
    <div style={S.wrap}>
      {/* Sidebar */}
      <aside style={S.sidebar}>
        <div style={S.brand}>
          <p style={S.brandTitle}>⚽ Golazo</p>
          <p style={S.brandSub}>Admin Panel</p>
        </div>
        <nav>
          {NAV.map(({ to, icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              style={({ isActive }) => ({
                ...S.navLink,
                background: isActive ? "rgba(238,30,70,.12)" : "transparent",
                color: isActive ? "#ee1e46" : "rgba(255,255,255,.5)",
                borderLeft: isActive ? "3px solid #ee1e46" : "3px solid transparent",
              })}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div style={{ marginTop: "auto", padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,.06)" }}>
          <p style={{ color: "rgba(255,255,255,.3)", fontSize: "0.72rem", margin: "0 0 8px" }}>
            {user?.name} · {user?.email}
          </p>
          <button
            onClick={handleLogout}
            style={{
              background: "rgba(238,30,70,.1)", border: "1px solid rgba(238,30,70,.2)",
              color: "#ee1e46", borderRadius: 6, padding: "6px 12px",
              fontSize: "0.78rem", cursor: "pointer", fontWeight: 600, width: "100%",
            }}
          >
            Sign out
          </button>
          <a
            href="/"
            style={{ display: "block", textAlign: "center", color: "rgba(255,255,255,.25)", fontSize: "0.72rem", marginTop: 8, textDecoration: "none" }}
          >
            ← Back to site
          </a>
        </div>
      </aside>

      {/* Main content */}
      <main style={S.main}>
        <Outlet />
      </main>
    </div>
  )
}
