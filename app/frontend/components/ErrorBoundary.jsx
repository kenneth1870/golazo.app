import { Component } from "react"
import { Link } from "react-router-dom"

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
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
