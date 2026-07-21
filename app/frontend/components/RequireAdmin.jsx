import { Navigate, useLocation } from "react-router-dom"
import { useAuthContext } from "../contexts/AuthContext"

export default function RequireAdmin({ children }) {
  const { isLoggedIn, isAdmin } = useAuthContext()
  const location = useLocation()

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  if (!isAdmin) {
    return (
      <div style={{
        minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
        background: "#0d1117", flexDirection: "column", gap: 16, padding: 24,
      }}>
        <div style={{ fontSize: "3rem" }}>🚫</div>
        <h2 style={{ color: "#fff", margin: 0 }}>Access denied</h2>
        <p style={{ color: "rgba(255,255,255,.4)", margin: 0 }}>Admin privileges required.</p>
        <a href="/" style={{ color: "var(--accent)", fontSize: "0.9rem" }}>← Back to site</a>
      </div>
    )
  }
  return children
}
