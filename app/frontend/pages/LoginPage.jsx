import { useState, useEffect, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAuthContext } from "../contexts/AuthContext"

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

export default function LoginPage() {
  const { login, loading, error } = useAuthContext()
  const navigate  = useNavigate()
  const location  = useLocation()
  const from      = location.state?.from?.pathname || "/admin"
  const [email,    setEmail]    = useState("")
  const [password, setPassword] = useState("")
  const [gError,   setGError]   = useState(null)
  const [gLoading, setGLoading] = useState(false)
  const googleBtnRef = useRef(null)

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    const scriptId = "gsi-script"
    if (document.getElementById(scriptId)) {
      initGoogle()
      return
    }
    const script = document.createElement("script")
    script.id  = scriptId
    script.src = "https://accounts.google.com/gsi/client"
    script.async = true
    script.defer = true
    script.onload = initGoogle
    document.head.appendChild(script)
  }, [])

  const initGoogle = () => {
    if (!window.google || !googleBtnRef.current) return
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
    })
    window.google.accounts.id.renderButton(googleBtnRef.current, {
      theme: "outline",
      size: "large",
      width: 336,
      text: "signin_with",
      shape: "rectangular",
    })
  }

  const handleGoogleCredential = async ({ credential }) => {
    setGLoading(true)
    setGError(null)
    try {
      const res = await fetch("/api/v1/sessions/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential }),
      })
      const data = await res.json()
      if (!res.ok) {
        setGError(data.error || "Google sign-in failed")
        return
      }
      localStorage.setItem("golazo_token", data.token)
      localStorage.setItem("golazo_user",  JSON.stringify(data.user))
      window.location.href = from
    } catch {
      setGError("Network error — try again")
    } finally {
      setGLoading(false)
    }
  }

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
        border: "1px solid var(--border)",
        borderRadius: 16, padding: "40px 32px",
        boxShadow: "0 16px 48px rgba(0,0,0,.5)",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 8 }}>⚽</div>
          <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: "var(--text)", margin: 0 }}>
            Golazo Admin
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "0.82rem", marginTop: 4 }}>
            Sign in to continue
          </p>
        </div>

        {/* Google Sign-In */}
        {GOOGLE_CLIENT_ID && (
          <>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
              <div ref={googleBtnRef} />
            </div>
            {gLoading && (
              <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "0.8rem", marginBottom: 8 }}>
                Signing in with Google…
              </p>
            )}
            {gError && (
              <div style={{
                background: "rgba(238,30,70,.12)", border: "1px solid rgba(238,30,70,.3)",
                borderRadius: 8, padding: "10px 14px", marginBottom: 12,
                color: "#f87171", fontSize: "0.82rem",
              }}>
                ⚠ {gError}
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span style={{ color: "var(--muted)", fontSize: "0.75rem" }}>or</span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", color: "var(--muted)", fontSize: "0.78rem", marginBottom: 6, fontWeight: 600 }}>
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
                background: "var(--surface2)", border: "1px solid var(--border)",
                borderRadius: 8, padding: "10px 14px",
                color: "var(--text)", fontSize: "0.95rem",
                outline: "none",
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: "block", color: "var(--muted)", fontSize: "0.78rem", marginBottom: 6, fontWeight: 600 }}>
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
                background: "var(--surface2)", border: "1px solid var(--border)",
                borderRadius: 8, padding: "10px 14px",
                color: "var(--text)", fontSize: "0.95rem",
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

        <p style={{ textAlign: "center", marginTop: 24, color: "var(--muted)", fontSize: "0.75rem" }}>
          Golazo · Admin Panel · v2
        </p>
      </div>
    </div>
  )
}
