import { Component } from "react"
import { Link } from "react-router-dom"

const CHUNK_RELOAD_KEY = "golazo_chunk_reload_at"
const CHUNK_RELOAD_TTL = 15_000

function isChunkError(error) {
  const msg = error?.message || ""
  return (
    msg.includes("Failed to fetch dynamically imported module") ||
    msg.includes("Loading chunk") ||
    msg.includes("Loading CSS chunk") ||
    error?.name === "ChunkLoadError"
  )
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    if (isChunkError(error)) {
      const last = parseInt(sessionStorage.getItem(CHUNK_RELOAD_KEY) || "0", 10)
      if (Date.now() - last > CHUNK_RELOAD_TTL) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, Date.now().toString())
        window.location.reload()
        return null
      }
    }
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info.componentStack)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="site-section">
        <div className="container">
          <div className="empty-state" style={{ padding: "60px 20px" }}>
            <div className="empty-state__icon">⚠️</div>
            <h3 style={{ color: "#fff", marginBottom: 8 }}>Something went wrong</h3>
            <p style={{ color: "var(--muted)", marginBottom: 24, fontSize: "0.85rem" }}>
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <Link
              to="/"
              className="btn btn-primary"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    )
  }
}
