import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { BrowserRouter } from "react-router-dom"
import { I18nextProvider } from "react-i18next"
import i18n from "../i18n"
import App from "../App"
import { LiveProvider } from "../contexts/LiveContext"
import { AuthProvider } from "../contexts/AuthContext"
import "../styles/application.css"

// Register service worker for PWA caching + offline support (production only)
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {})
  })
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <I18nextProvider i18n={i18n}>
      <BrowserRouter>
        <AuthProvider>
          <LiveProvider>
            <App />
          </LiveProvider>
        </AuthProvider>
      </BrowserRouter>
    </I18nextProvider>
  </StrictMode>
)
