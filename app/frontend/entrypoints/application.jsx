import { StrictMode, useState, useEffect } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { I18nextProvider } from "react-i18next"
import i18n, { initPromise } from "../i18n"
import App from "../App"
import { LiveProvider } from "../contexts/LiveContext"
import { AuthProvider } from "../contexts/AuthContext"
import "../styles/application.css"

function BootLoader() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
      <div className="spinner" />
    </div>
  )
}

function RootApp() {
  const [ready, setReady] = useState(i18n.isInitialized)

  useEffect(() => {
    if (ready) return
    initPromise.then(() => setReady(true)).catch(() => setReady(true))
  }, [ready])

  if (!ready) return <BootLoader />

  return (
    <I18nextProvider i18n={i18n}>
      <BrowserRouter>
        <AuthProvider>
          <LiveProvider>
            <App />
          </LiveProvider>
        </AuthProvider>
      </BrowserRouter>
    </I18nextProvider>
  )
}

// Register service worker for PWA caching + offline support (production only)
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {})

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!window.__swReloading) {
        window.__swReloading = true
        window.location.reload()
      }
    })
  })
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <RootApp />
  </StrictMode>
)
