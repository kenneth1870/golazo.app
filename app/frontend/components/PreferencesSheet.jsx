import { useTranslation } from "react-i18next"
import { dismissOverlayProps } from "../utils/dismissOverlay"
import { useFocusTrap } from "../hooks/useFocusTrap"
import ThemeToggle from "./ThemeToggle"
import LanguageSwitcher from "./LanguageSwitcher"
import { NotifToggle } from "./Navbar"
import { usePushNotifications } from "../hooks/usePushNotifications"
import { useFavorites } from "../hooks/useFavorites"
import { translateLeague } from "../i18n/leagueNames"
import { translateTeam } from "../i18n/teamNames"

function PushScopeSummary() {
  const { t, i18n } = useTranslation()
  const { subscribed, scope, syncScopeFromFavorites, loading } = usePushNotifications()
  const { favorites } = useFavorites()

  if (!subscribed) return null

  const teams = scope?.teamNames || []
  const leagues = scope?.competitionCodes || []
  const empty = teams.length === 0 && leagues.length === 0

  return (
    <div className="prefs-sheet__scope">
      <div className="prefs-sheet__scope-label">{t("preferences.notifScope")}</div>
      {empty ? (
        <p className="prefs-sheet__scope-empty">{t("preferences.notifScopeEmpty")}</p>
      ) : (
        <ul className="prefs-sheet__scope-list">
          {teams.map(name => (
            <li key={`team-${name}`}>⚽ {translateTeam(name, i18n.language) || name}</li>
          ))}
          {leagues.map(code => (
            <li key={`league-${code}`}>🏆 {translateLeague(code, i18n.language) || code}</li>
          ))}
        </ul>
      )}
      <button
        type="button"
        className="prefs-sheet__scope-sync focus-brand"
        disabled={loading}
        onClick={() => syncScopeFromFavorites(favorites)}
      >
        {t("preferences.syncFavorites")}
      </button>
    </div>
  )
}

export default function PreferencesSheet({ open, onClose }) {
  const { t } = useTranslation()
  const panelRef = useFocusTrap(open)
  if (!open) return null

  return (
    <div className="prefs-sheet" role="dialog" aria-modal="true" aria-label={t("preferences.title")}>
      <div className="prefs-sheet__backdrop" {...dismissOverlayProps(onClose)} />
      <div ref={panelRef} className="prefs-sheet__panel">
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
          <PushScopeSummary />
        </div>
      </div>
    </div>
  )
}
