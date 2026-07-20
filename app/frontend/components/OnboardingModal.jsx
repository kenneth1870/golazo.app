// @refresh reset
/**
 * OnboardingModal — shown once to new users on first visit.
 * Three steps:
 *   1. Welcome + language pick
 *   2. Pick favorite teams (WC teams grid)
 *   3. Pick favorite leagues + enable notifications CTA
 *
 * Skipped entirely if localStorage key "golazo_onboarded" is set.
 * Writes selections directly into golazo_favorites (same format as useFavorites).
 */
import { useState, useEffect, useCallback, useRef } from "react"
import { useTranslation } from "react-i18next"
import { storageGet, storageSet } from "../utils/safeStorage"

function persistLanguage(code) {
  storageSet("golazo_lang", code)
  storageSet("golazo_lang_manual", "1")
}
import { useFavorites } from "../hooks/useFavorites"
import { usePushNotifications } from "../hooks/usePushNotifications"
import { useAppFocus } from "../hooks/useAppFocus"
import { isIosSafari, isStandalone } from "../utils/platform"
import { translateTeam } from "../i18n/teamNames"
import { loadClubTeams } from "../utils/loadClubTeams"

const ONBOARDED_KEY = "golazo_onboarded"
const ONBOARDED_AT_KEY = "golazo_onboarded_at"

// Top WC 2026 nations — hardcoded so onboarding works offline / before API loads
// Flags from flagcdn.com (supports CORS, cached by SW)
const WC_TEAMS = [
  { id: 765, name: "Argentina",     flag: "https://flagcdn.com/w40/ar.png" },
  { id: 760, name: "France",        flag: "https://flagcdn.com/w40/fr.png" },
  { id: 764, name: "Brazil",        flag: "https://flagcdn.com/w40/br.png" },
  { id: 759, name: "England",       flag: "https://flagcdn.com/w40/gb-eng.png" },
  { id: 766, name: "Spain",         flag: "https://flagcdn.com/w40/es.png" },
  { id: 785, name: "Portugal",      flag: "https://flagcdn.com/w40/pt.png" },
  { id: 769, name: "Mexico",        flag: "https://flagcdn.com/w40/mx.png" },
  { id: 768, name: "Germany",       flag: "https://flagcdn.com/w40/de.png" },
  { id: 771, name: "Netherlands",   flag: "https://flagcdn.com/w40/nl.png" },
  { id: 772, name: "South Korea",   flag: "https://flagcdn.com/w40/kr.png" },
  { id: 298, name: "Morocco",       flag: "https://flagcdn.com/w40/ma.png" },
  { id: 773, name: "United States", flag: "https://flagcdn.com/w40/us.png" },
  { id: 774, name: "Colombia",      flag: "https://flagcdn.com/w40/co.png" },
  { id: 311, name: "Canada",        flag: "https://flagcdn.com/w40/ca.png" },
  { id: 799, name: "Japan",         flag: "https://flagcdn.com/w40/jp.png" },
  { id: 763, name: "Uruguay",       flag: "https://flagcdn.com/w40/uy.png" },
  { id: 286, name: "Croatia",       flag: "https://flagcdn.com/w40/hr.png" },
  { id: 762, name: "Senegal",       flag: "https://flagcdn.com/w40/sn.png" },
  { id: 289, name: "Australia",     flag: "https://flagcdn.com/w40/au.png" },
  { id: 778, name: "Ecuador",       flag: "https://flagcdn.com/w40/ec.png" },
]

const LEAGUE_DEFS = [
  { code: "PL",  key: "clubs.pl",  flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { code: "LAL", key: "clubs.lal", flag: "🇪🇸" },
  { code: "BL1", key: "clubs.bl1", flag: "🇩🇪" },
  { code: "SA",  key: "clubs.sa",  flag: "🇮🇹" },
  { code: "L1",  key: "clubs.l1",  flag: "🇫🇷" },
  { code: "UCL", key: "clubs.ucl", flag: "⭐" },
  { code: "MLS", key: "clubs.mls", flag: "🇺🇸" },
  { code: "LMX", key: "clubs.lmx", flag: "🇲🇽" },
  { code: "CRC", key: "clubs.crc", flag: "🇨🇷" },
  { code: "WC",  key: "nav.mundial", flag: "🌍" },
]

const LANGS = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "es", label: "Español", flag: "🇪🇸" },
]

export function useOnboarding() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    // Small delay so app renders first
    const t = setTimeout(() => {
      if (!storageGet(ONBOARDED_KEY)) setShow(true)
    }, 600)
    return () => clearTimeout(t)
  }, [])
  const dismiss = useCallback(() => {
    storageSet(ONBOARDED_KEY, "1")
    storageSet(ONBOARDED_AT_KEY, Date.now().toString())
    setShow(false)
  }, [])
  return { show, dismiss }
}

export default function OnboardingModal({ onDismiss }) {
  const { t, i18n } = useTranslation()
  const { addFavorite, favorites } = useFavorites()
  const { subscribe } = usePushNotifications()
  const { push_enabled: pushEnabled = false, clubs_primary: clubsPrimary = true } = useAppFocus()

  const [step, setStep]               = useState(0)
  const [selectedTeams, setTeams]     = useState([])
  const [selectedLeagues, setLeagues] = useState([])
  const [notifDone, setNotifDone]     = useState(false)
  const [notifErr, setNotifErr]       = useState(null)
  const [notifLoading, setNotifLoading] = useState(false)
  const [animating, setAnimating]     = useState(false)
  const [dragY, setDragY]             = useState(0)
  const [clubTeams, setClubTeams]       = useState([])
  const dragStart                     = useRef(null)

  useEffect(() => {
    if (clubsPrimary) loadClubTeams(setClubTeams)
  }, [clubsPrimary])

  const onIosSafari  = isIosSafari()
  const onIosPwa     = onIosSafari && isStandalone()

  const toggleTeam = (team) => {
    const key = team.id ?? team.name
    setTeams(prev =>
      prev.some(t => (t.id ?? t.name) === key)
        ? prev.filter(t => (t.id ?? t.name) !== key)
        : [...prev, team]
    )
  }

  const toggleLeague = (league) => {
    setLeagues(prev =>
      prev.some(l => l.code === league.code)
        ? prev.filter(l => l.code !== league.code)
        : [...prev, league]
    )
  }

  const goNext = () => {
    setAnimating(true)
    setTimeout(() => { setStep(s => s + 1); setAnimating(false) }, 220)
  }

  const finish = () => {
    selectedTeams.forEach(team => {
      addFavorite({
        type: "team",
        id: team.id ?? team.name,
        name: team.name,
        flag_url: team.flag ?? team.flag_url,
        league_code: team.league_code,
      })
    })
    selectedLeagues.forEach(league => {
      addFavorite({ type: "competition", id: league.code, name: t(league.key), code: league.code })
    })
    storageSet(ONBOARDED_AT_KEY, Date.now().toString())
    onDismiss()
  }

  const requestNotifications = async () => {
    setNotifLoading(true)
    setNotifErr(null)
    const result = await subscribe(selectedTeams.map(t => t.name))
    setNotifLoading(false)
    if (result?.ok) {
      setNotifDone(true)
    } else if (result?.error === "Permission denied") {
      setNotifDone(true) // user denied — don't block, just move on
    } else if (result?.error) {
      setNotifErr(result.error)
    } else {
      setNotifDone(true)
    }
  }

  const visibleLeagues = LEAGUE_DEFS.filter(l => !clubsPrimary || l.code !== "WC")

  const steps = [
    {
      key: "welcome",
      title: t("onboarding.welcome", "Welcome to Golazo! ⚽"),
      subtitle: t(clubsPrimary ? "onboarding.welcomeSubClubs" : "onboarding.welcomeSub"),
      content: (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: 24 }}>
          {LANGS.map(lang => (
            <button
              key={lang.code}
              onClick={() => { persistLanguage(lang.code); i18n.changeLanguage(lang.code).then(goNext) }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "12px 20px", borderRadius: 12,
                background: i18n.language.startsWith(lang.code)
                  ? "var(--accent, #ee1e46)" : "var(--surface2, #1a1a1a)",
                border: "1px solid var(--border, #2a2a2a)",
                color: i18n.language.startsWith(lang.code) ? "#fff" : "var(--text)", cursor: "pointer", fontSize: "1rem", fontWeight: 500,
                transition: "all .15s",
              }}
            >
              <span style={{ fontSize: "1.4rem" }}>{lang.flag}</span>
              {lang.label}
            </button>
          ))}
        </div>
      ),
      cta: null, // language buttons advance automatically
    },
    ...(clubsPrimary ? [{
      key: "clubTeams",
      title: t("onboarding.pickClubTeams", "Pick your clubs"),
      subtitle: t("onboarding.pickClubTeamsSub", "We'll personalise your news feed and alerts."),
      content: (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8,
          maxHeight: 340, overflowY: "auto", marginTop: 16, paddingRight: 4,
        }}>
          {clubTeams.map(team => {
            const key = team.id ?? team.name
            const selected = selectedTeams.some(t => (t.id ?? t.name) === key)
            return (
              <button
                key={key}
                onClick={() => toggleTeam(team)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  gap: 6, padding: "10px 4px", borderRadius: 12, cursor: "pointer",
                  background: selected ? "rgba(238,30,70,.18)" : "var(--surface2, #1a1a1a)",
                  border: `1px solid ${selected ? "var(--accent,#ee1e46)" : "var(--border,#2a2a2a)"}`,
                  transition: "all .15s",
                }}
              >
                {team.flag_url ? (
                  <img
                    src={team.flag_url} alt={team.name}
                    style={{ width: 32, height: 32, objectFit: "contain" }}
                    onError={e => { e.target.style.display = "none" }}
                  />
                ) : (
                  <span style={{ fontSize: "1.4rem" }}>⚽</span>
                )}
                <span style={{
                  fontSize: "0.62rem", color: selected ? "var(--accent,#ee1e46)" : "var(--muted,#888)",
                  textAlign: "center", lineHeight: 1.2, fontWeight: selected ? 600 : 400,
                }}>
                  {translateTeam(team.name, i18n.language) || team.name}
                </span>
                {selected && (
                  <span style={{ fontSize: "0.6rem", color: "var(--accent,#ee1e46)", fontWeight: 700 }}>✓</span>
                )}
              </button>
            )
          })}
          {clubTeams.length === 0 && (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "var(--muted)", fontSize: "0.82rem", padding: 24 }}>
              {t("loading")}
            </div>
          )}
        </div>
      ),
      cta: t("onboarding.continue", "Continue"),
      ctaAction: goNext,
      skip: true,
    }] : [{
      key: "teams",
      title: t("onboarding.pickTeams", "Pick your teams"),
      subtitle: t("onboarding.pickTeamsSub", "We'll personalize your news feed and alerts."),
      content: (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8,
          maxHeight: 340, overflowY: "auto", marginTop: 16, paddingRight: 4,
        }}>
          {WC_TEAMS.map(team => {
            const selected = selectedTeams.some(t => t.id === team.id)
            return (
              <button
                key={team.id}
                onClick={() => toggleTeam(team)}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  gap: 6, padding: "10px 4px", borderRadius: 12, cursor: "pointer",
                  background: selected ? "rgba(238,30,70,.18)" : "var(--surface2, #1a1a1a)",
                  border: `1px solid ${selected ? "var(--accent,#ee1e46)" : "var(--border,#2a2a2a)"}`,
                  transition: "all .15s",
                }}
              >
                <img
                  src={team.flag} alt={team.name}
                  style={{ width: 32, height: 32, objectFit: "contain" }}
                  onError={e => { e.target.style.display = "none" }}
                />
                <span style={{
                  fontSize: "0.62rem", color: selected ? "var(--accent,#ee1e46)" : "var(--muted,#888)",
                  textAlign: "center", lineHeight: 1.2, fontWeight: selected ? 600 : 400,
                }}>
                  {translateTeam(team.name, i18n.language) || team.name}
                </span>
                {selected && (
                  <span style={{ fontSize: "0.6rem", color: "var(--accent,#ee1e46)", fontWeight: 700 }}>✓</span>
                )}
              </button>
            )
          })}
        </div>
      ),
      cta: t("onboarding.continue", "Continue"),
      ctaAction: goNext,
      skip: true,
    }]),
    {
      key: "leagues",
      title: t("onboarding.pickLeagues", "Follow leagues"),
      subtitle: t("onboarding.pickLeaguesSub", "Get scores and news for your favourite competitions."),
      content: (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16, justifyContent: "center" }}>
          {visibleLeagues.map(league => {
            const selected = selectedLeagues.some(l => l.code === league.code)
            return (
              <button
                key={league.code}
                onClick={() => toggleLeague(league)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "10px 16px", borderRadius: 20, cursor: "pointer",
                  background: selected ? "rgba(238,30,70,.18)" : "var(--surface2,#1a1a1a)",
                  border: `1px solid ${selected ? "var(--accent,#ee1e46)" : "var(--border,#2a2a2a)"}`,
                  color: selected ? "var(--accent,#ee1e46)" : "var(--muted,#888)",
                  fontSize: "0.85rem", fontWeight: selected ? 600 : 400,
                  transition: "all .15s",
                }}
              >
                <span>{league.flag}</span>
                {t(league.key)}
                {selected && <span style={{ color: "var(--accent,#ee1e46)", fontWeight: 700 }}>✓</span>}
              </button>
            )
          })}
        </div>
      ),
      cta: t("onboarding.continue", "Continue"),
      ctaAction: goNext,
      skip: true,
    },
    {
      key: "notifications",
      title: t("onboarding.alerts", "Never miss a goal ⚽"),
      subtitle: onIosSafari && !onIosPwa
        ? t("onboarding.iosAlertsSub", "Add Golazo to your home screen to enable live push notifications.")
        : t("onboarding.alertsSub", "Get instant push notifications for goals, cards, and final whistles from your teams."),
      content: (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          {/* Alert types */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 280, margin: "0 auto 20px" }}>
            {[t("onboarding.alertGoals"), t("onboarding.alertCards"), t("onboarding.alertKickoffs"), t("onboarding.alertFinal")].map(item => (
              <div key={item} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 14px", borderRadius: 10,
                background: "var(--surface2,#1a1a1a)", border: "1px solid var(--border,#2a2a2a)",
                fontSize: "0.85rem", color: "#ccc",
              }}>
                <span>{item}</span>
              </div>
            ))}
          </div>

          {/* iOS Safari — not yet installed as PWA */}
          {onIosSafari && !onIosPwa && (
            <div style={{
              background: "rgba(238,30,70,.08)", border: "1px solid rgba(238,30,70,.25)",
              borderRadius: 12, padding: "16px 14px", maxWidth: 300, margin: "0 auto",
            }}>
              <div style={{ fontSize: ".8rem", color: "var(--muted)", lineHeight: 1.6 }}>
                <div style={{ marginBottom: 10, fontWeight: 700, color: "var(--text)" }}>
                  📲 {t("ios.howToInstall", "How to install:")}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "left" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: "1.1rem" }}>1.</span>
                    <span>{t("ios.step1", "Tap the")} <strong style={{ color: "var(--text)" }}>Share</strong> {t("ios.step1b", "button")} <svg style={{ display: "inline", verticalAlign: "middle" }} width="14" height="16" viewBox="0 0 24 28" fill="currentColor"><path d="M12 0L6 6h4v12h4V6h4L12 0zM2 20v6h20v-6h-2v4H4v-4H2z"/></svg></span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: "1.1rem" }}>2.</span>
                    <span>{t("ios.step2prefix", "Tap")} <strong style={{ color: "var(--text)" }}>{t("ios.step2", '"Add to Home Screen"')}</strong></span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: "1.1rem" }}>3.</span>
                    <span>{t("ios.step3prefix", "Open Golazo from your home screen and enable alerts")}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* iOS PWA — can enable now */}
          {onIosPwa && !notifDone && (
            <button onClick={requestNotifications} disabled={notifLoading} style={{
              padding: "13px 28px", borderRadius: 12, background: "var(--accent,#ee1e46)",
              border: "none", color: "#fff", fontSize: ".95rem", fontWeight: 700,
              cursor: notifLoading ? "default" : "pointer", opacity: notifLoading ? .6 : 1,
            }}>
              {notifLoading ? t("push.enabling", "Enabling…") : t("onboarding.enableAlerts", "Enable alerts")}
            </button>
          )}

          {/* Chrome / Android — enable directly */}
          {!onIosSafari && !notifDone && (
            <button onClick={requestNotifications} disabled={notifLoading} style={{
              padding: "13px 28px", borderRadius: 12, background: "var(--accent,#ee1e46)",
              border: "none", color: "#fff", fontSize: ".95rem", fontWeight: 700,
              cursor: notifLoading ? "default" : "pointer", opacity: notifLoading ? .6 : 1,
            }}>
              {notifLoading ? t("push.enabling", "Enabling…") : t("onboarding.enableAlerts", "Enable alerts")}
            </button>
          )}

          {notifErr && (
            <div style={{ marginTop: 12, fontSize: ".78rem", color: "#f87171" }}>
              ⚠ {notifErr}
            </div>
          )}

          {notifDone && (
            <div style={{ marginTop: 16, color: "#10b981", fontWeight: 700, fontSize: ".95rem" }}>
              ✓ {t("onboarding.alertsEnabled", "Alerts enabled!")}
            </div>
          )}
        </div>
      ),
      cta: t("onboarding.letsGo", "Let's go!"),
      ctaAction: finish,
      skip: false,
    },
  ].filter(s => pushEnabled || s.key !== "notifications")

  const current = steps[step]
  const total   = steps.length

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-end",
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Sheet */}
      <div
        onTouchStart={e => {
          // Don't start dismiss gesture if touch begins inside a scrollable child
          // (e.g. the team grid on step 2 — scrolling it would wrongly dismiss)
          let el = e.target
          while (el && el !== e.currentTarget) {
            const style = getComputedStyle(el)
            if (["auto", "scroll"].includes(style.overflowY) && el.scrollHeight > el.clientHeight) {
              dragStart.current = null
              return
            }
            el = el.parentElement
          }
          dragStart.current = e.touches[0].clientY
        }}
        onTouchMove={e => {
          if (dragStart.current === null) return
          const delta = e.touches[0].clientY - dragStart.current
          if (delta > 0) setDragY(delta)
        }}
        onTouchEnd={() => {
          if (dragY > 80) { setDragY(0); dragStart.current = null; finish() }
          else { setDragY(0); dragStart.current = null }
        }}
        style={{
          width: "100%", maxWidth: 520, margin: "0 auto",
          background: "var(--surface,#111)", borderRadius: "20px 20px 0 0",
          padding: "28px 24px 40px", position: "relative",
          maxHeight: "90vh", overflowY: "auto",
          opacity: animating ? 0 : 1,
          transform: animating ? "translateY(12px)" : `translateY(${dragY}px)`,
          transition: dragY > 0 ? "none" : "opacity .2s, transform .2s",
        }}
      >
        {/* Drag handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--border,#2a2a2a)", margin: "-12px auto 20px", flexShrink: 0 }} />

        {/* Progress dots */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 20 }}>
          {steps.map((_, i) => (
            <div
              key={i}
              style={{
                width: i === step ? 20 : 6, height: 6, borderRadius: 3,
                background: i <= step ? "var(--accent,#ee1e46)" : "var(--border,#2a2a2a)",
                transition: "all .25s",
              }}
            />
          ))}
        </div>

        {/* Skip (top right) */}
        {step > 0 && (
          <button
            onClick={finish}
            style={{
              position: "absolute", top: 20, right: 20,
              background: "none", border: "none", color: "var(--muted,#888)",
              fontSize: "0.8rem", cursor: "pointer", padding: "4px 8px",
            }}
          >
            {t("onboarding.skip", "Skip")}
          </button>
        )}

        <h2 style={{ textAlign: "center", fontSize: "1.3rem", fontWeight: 700, margin: 0 }}>
          {current.title}
        </h2>
        <p style={{ textAlign: "center", color: "var(--muted,#888)", fontSize: "0.9rem", marginTop: 8, marginBottom: 0 }}>
          {current.subtitle}
        </p>

        {current.content}

        {current.cta && (
          <div style={{ marginTop: 24, display: "flex", gap: 10, justifyContent: "center" }}>
            {current.skip && step > 0 && (
              <button
                onClick={current.ctaAction}
                style={{
                  flex: 1, maxWidth: 200, padding: "14px", borderRadius: 12,
                  background: "var(--surface2,#1a1a1a)", border: "1px solid var(--border,#2a2a2a)",
                  color: "var(--muted,#888)", fontSize: "0.95rem", cursor: "pointer",
                }}
              >
                {selectedTeams.length === 0 && step === 1
                  ? t("onboarding.skip", "Skip")
                  : selectedLeagues.length === 0 && step === 2
                    ? t("onboarding.skip", "Skip")
                    : current.cta}
              </button>
            )}
            <button
              onClick={current.ctaAction}
              disabled={step === 1 && selectedTeams.length === 0 && false}
              style={{
                flex: 2, maxWidth: 280, padding: "14px", borderRadius: 12,
                background: "var(--accent,#ee1e46)", border: "none",
                color: "#fff", fontSize: "1rem", fontWeight: 700, cursor: "pointer",
              }}
            >
              {step === 1 && selectedTeams.length > 0
                ? `${current.cta} (${selectedTeams.length})`
                : step === 2 && selectedLeagues.length > 0
                  ? `${current.cta} (${selectedLeagues.length})`
                  : current.cta}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
