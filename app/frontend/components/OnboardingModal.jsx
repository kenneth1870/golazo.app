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
import { useState, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { storageGet, storageSet } from "../utils/safeStorage"
import { useFavorites } from "../hooks/useFavorites"

const ONBOARDED_KEY = "golazo_onboarded"

// Top WC 2026 nations — hardcoded so onboarding works offline / before API loads
const WC_TEAMS = [
  { id: 765, name: "Argentina",    flag: "https://crests.football-data.org/762.svg" },
  { id: 760, name: "France",       flag: "https://crests.football-data.org/773.svg" },
  { id: 764, name: "Brazil",       flag: "https://crests.football-data.org/764.svg" },
  { id: 759, name: "England",      flag: "https://crests.football-data.org/770.svg" },
  { id: 766, name: "Spain",        flag: "https://crests.football-data.org/760.svg" },
  { id: 785, name: "Portugal",     flag: "https://crests.football-data.org/765.svg" },
  { id: 769, name: "Mexico",       flag: "https://crests.football-data.org/769.svg" },
  { id: 768, name: "Germany",      flag: "https://crests.football-data.org/759.svg" },
  { id: 771, name: "Netherlands",  flag: "https://crests.football-data.org/784.svg" },
  { id: 772, name: "South Korea",  flag: "https://crests.football-data.org/772.png" },
  { id: 298, name: "Morocco",      flag: "https://crests.football-data.org/morocco.svg" },
  { id: 773, name: "USA",          flag: "https://crests.football-data.org/usa.svg" },
  { id: 774, name: "Colombia",     flag: "https://crests.football-data.org/775.svg" },
  { id: 311, name: "Canada",       flag: "https://crests.football-data.org/canada.svg" },
  { id: 799, name: "Japan",        flag: "https://crests.football-data.org/799.svg" },
  { id: 763, name: "Uruguay",      flag: "https://crests.football-data.org/803.svg" },
  { id: 286, name: "Croatia",      flag: "https://crests.football-data.org/799.svg" },
  { id: 762, name: "Senegal",      flag: "https://crests.football-data.org/senegal.svg" },
  { id: 289, name: "Australia",    flag: "https://crests.football-data.org/772.png" },
  { id: 778, name: "Ecuador",      flag: "https://crests.football-data.org/ecuador.svg" },
]

const LEAGUES = [
  { code: "PL",  name: "Premier League",      flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { code: "LAL", name: "La Liga",             flag: "🇪🇸" },
  { code: "BL1", name: "Bundesliga",          flag: "🇩🇪" },
  { code: "SA",  name: "Serie A",             flag: "🇮🇹" },
  { code: "L1",  name: "Ligue 1",             flag: "🇫🇷" },
  { code: "UCL", name: "Champions League",    flag: "⭐" },
  { code: "MLS", name: "MLS",                 flag: "🇺🇸" },
  { code: "WC",  name: "World Cup 2026",      flag: "🌍" },
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
    setShow(false)
  }, [])
  return { show, dismiss }
}

export default function OnboardingModal({ onDismiss }) {
  const { t, i18n } = useTranslation()
  const { addFavorite, favorites } = useFavorites()

  const [step, setStep]               = useState(0)
  const [selectedTeams, setTeams]     = useState([])
  const [selectedLeagues, setLeagues] = useState([])
  const [notifDone, setNotifDone]     = useState(false)
  const [animating, setAnimating]     = useState(false)

  const toggleTeam = (team) => {
    setTeams(prev =>
      prev.some(t => t.id === team.id)
        ? prev.filter(t => t.id !== team.id)
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
    // Persist selected teams
    selectedTeams.forEach(team => {
      addFavorite({ type: "team", id: team.id, name: team.name, flag_url: team.flag })
    })
    // Persist selected leagues
    selectedLeagues.forEach(league => {
      addFavorite({ type: "competition", id: league.code, name: league.name, code: league.code })
    })
    onDismiss()
  }

  const requestNotifications = async () => {
    try {
      const perm = await Notification.requestPermission()
      setNotifDone(true)
    } catch {
      setNotifDone(true)
    }
  }

  const steps = [
    {
      key: "welcome",
      title: t("onboarding.welcome", "Welcome to Golazo! ⚽"),
      subtitle: t("onboarding.welcomeSub", "Your World Cup 2026 companion. Choose your language to get started."),
      content: (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: 24 }}>
          {LANGS.map(lang => (
            <button
              key={lang.code}
              onClick={() => { i18n.changeLanguage(lang.code); goNext() }}
              style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "12px 20px", borderRadius: 12,
                background: i18n.language.startsWith(lang.code)
                  ? "var(--accent, #ee1e46)" : "var(--surface2, #1a1a1a)",
                border: "1px solid var(--border, #2a2a2a)",
                color: "#fff", cursor: "pointer", fontSize: "1rem", fontWeight: 500,
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
    {
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
                  fontSize: "0.62rem", color: selected ? "#fff" : "var(--muted,#888)",
                  textAlign: "center", lineHeight: 1.2, fontWeight: selected ? 600 : 400,
                }}>
                  {team.name}
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
    },
    {
      key: "leagues",
      title: t("onboarding.pickLeagues", "Follow leagues"),
      subtitle: t("onboarding.pickLeaguesSub", "Get scores and news for your favourite competitions."),
      content: (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16, justifyContent: "center" }}>
          {LEAGUES.map(league => {
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
                  color: selected ? "#fff" : "var(--muted,#888)",
                  fontSize: "0.85rem", fontWeight: selected ? 600 : 400,
                  transition: "all .15s",
                }}
              >
                <span>{league.flag}</span>
                {league.name}
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
      subtitle: t("onboarding.alertsSub", "Get instant push notifications for goals, cards, and final whistles from your teams."),
      content: (
        <div style={{ textAlign: "center", marginTop: 24 }}>
          <div style={{ fontSize: "3rem", marginBottom: 16 }}>🔔</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 280, margin: "0 auto" }}>
            {["⚽ Goal alerts", "🟥 Red cards", "🏁 Final scores", "📰 Team news"].map(item => (
              <div key={item} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 16px", borderRadius: 10,
                background: "var(--surface2,#1a1a1a)", border: "1px solid var(--border,#2a2a2a)",
                fontSize: "0.9rem", color: "#ccc",
              }}>
                <span>{item}</span>
              </div>
            ))}
          </div>
          {!notifDone ? (
            <button
              onClick={requestNotifications}
              style={{
                marginTop: 24, padding: "14px 32px", borderRadius: 12,
                background: "var(--accent,#ee1e46)", border: "none",
                color: "#fff", fontSize: "1rem", fontWeight: 700, cursor: "pointer",
              }}
            >
              {t("onboarding.enableAlerts", "Enable alerts")}
            </button>
          ) : (
            <div style={{ marginTop: 24, color: "#10b981", fontWeight: 600 }}>
              ✓ {t("onboarding.alertsEnabled", "Alerts enabled!")}
            </div>
          )}
        </div>
      ),
      cta: t("onboarding.letsGo", "Let's go!"),
      ctaAction: finish,
      skip: false,
    },
  ]

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
        style={{
          width: "100%", maxWidth: 520, margin: "0 auto",
          background: "var(--surface,#111)", borderRadius: "20px 20px 0 0",
          padding: "28px 24px 40px", position: "relative",
          maxHeight: "90vh", overflowY: "auto",
          opacity: animating ? 0 : 1, transform: animating ? "translateY(12px)" : "translateY(0)",
          transition: "opacity .2s, transform .2s",
        }}
      >
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
