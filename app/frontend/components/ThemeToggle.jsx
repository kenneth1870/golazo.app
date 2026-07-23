import { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"

export default function ThemeToggle() {
  const { t } = useTranslation()
  const [light, setLight] = useState(() => {
    try { return localStorage.getItem("golazo_theme") === "light" } catch { return false }
  })
  useEffect(() => {
    document.body.classList.toggle("light-mode", light)
    try { localStorage.setItem("golazo_theme", light ? "light" : "dark") } catch {}
  }, [light])
  return (
    <button
      type="button"
      onClick={() => setLight(v => !v)}
      title={light ? t("a11y.themeDark") : t("a11y.themeLight")}
      aria-label={light ? t("a11y.themeDark") : t("a11y.themeLight")}
      className="theme-toggle focus-brand"
    >
      {light ? "☀️" : "🌙"}
    </button>
  )
}
