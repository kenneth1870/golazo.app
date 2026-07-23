import { useTranslation } from "react-i18next"
import { dismissOverlayProps } from "../utils/dismissOverlay"
import ThemeToggle from "./ThemeToggle"
import LanguageSwitcher from "./LanguageSwitcher"
import { NotifToggle } from "./Navbar"

export default function PreferencesSheet({ open, onClose }) {
  const { t } = useTranslation()
  if (!open) return null

  return (
    <div className="prefs-sheet" role="dialog" aria-modal="true" aria-label={t("preferences.title")}>
      <div className="prefs-sheet__backdrop" {...dismissOverlayProps(onClose)} />
      <div className="prefs-sheet__panel">
        <div className="prefs-sheet__handle" aria-hidden="true" />
        <div className="prefs-sheet__header">
          <h2 className="prefs-sheet__title">{t("preferences.title")}</h2>
          <button type="button" className="prefs-sheet__close focus-brand" onClick={onClose} aria-label={t("a11y.close")}>✕</button>
        </div>

        <div className="prefs-sheet__row">
          <span className="prefs-sheet__label">{t("preferences.theme")}</span>
          <ThemeToggle />
        </div>

        <div className="prefs-sheet__row">
          <span className="prefs-sheet__label">{t("preferences.language")}</span>
          <LanguageSwitcher />
        </div>

        <div className="prefs-sheet__row prefs-sheet__row--block">
          <span className="prefs-sheet__label">{t("preferences.notifications")}</span>
          <NotifToggle variant="drawer" />
        </div>
      </div>
    </div>
  )
}
