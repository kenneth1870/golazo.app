import { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAuthContext } from "../contexts/AuthContext"

export default function LoginPage() {
  const { login, loading, error } = useAuthContext()
  const navigate  = useNavigate()
  const location  = useLocation()
  const from      = location.state?.from?.pathname || "/admin"
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")

  const handleSubmit = async (e) => {
    e.preventDefault()
    const ok = await login(email, password)
    if (ok) navigate(from, { replace: true })
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg, #0d1117)", padding: 16,
    }}>
      <div style={{
        width: "100%", maxWidth: 400,
        background: "var(--surface, #161b22)",
        border: "1px solid rgba(255,255,255,.08)",
        borderRadius: 16, padding: "40px 32px",
        boxShadow: "0 16px 48px rgba(0,0,0,.5)",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>⚽</div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "#fff", margin: 0 }}>
            Golazo Admin
          </h1>
          <p style={{ color: "rgba(255,255,255,.4)", fontSize: "0.82rem", marginTop: 4 }}>
            Sign in to continue
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", color: "rgba(255,255,255,.6)", fontSize: "0.78rem", marginBottom: 6, fontWeight: 600 }}>
              EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
              style={{
                width: "100%", boxSizing: "border-box",
                background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)",
                borderRadius: 8, padding: "10px 14px",
                color: "#fff", fontSize: "0.95rem",
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", color: "rgba(255,255,255,.6)", fontSize: "0.78rem", marginBottom: 6, fontWeight: 600 }}>
              PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              style={{
                width: "100%", boxSizing: "border-box",
                background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)",
                borderRadius: 8, padding: "10px 14px",
                color: "#fff", fontSize: "0.95rem",
                outline: "none",
              }}
            />
          </div>

          {error && (
            <div style={{
              background: "rgba(238,30,70,.12)", border: "1px solid rgba(238,30,70,.3)",
              borderRadius: 8, padding: "10px 14px", marginBottom: 16,
              color: "#f87171", fontSize: "0.82rem",
            }}>
              ⚠ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", background: "#ee1e46", color: "#fff", border: "none",
              borderRadius: 10, padding: "12px 0", fontWeight: 800, fontSize: "0.95rem",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 24, color: "rgba(255,255,255,.3)", fontSize: "0.75rem" }}>
          Golazo · Admin Panel · v2
        </p>
      </div>
    </div>
  )
}
