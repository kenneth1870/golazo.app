import { useEffect, useRef, useState, memo, useCallback, Fragment } from "react"
import { Link, NavLink, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import LanguageSwitcher from "./LanguageSwitcher"
import SearchBar from "./SearchBar"
import { useLiveCount } from "../contexts/LiveContext"
import { usePushNotifications } from "../hooks/usePushNotifications"
import { useAppFocus } from "../hooks/useAppFocus"
import { NAV_LEAGUES } from "./ClubCompetitionChips"
import ThemeToggle from "./ThemeToggle"
import { dismissOverlayProps } from "../utils/dismissOverlay"
import PreferencesSheet from "./PreferencesSheet"

const GROUPS = Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i))

// ─── Theme toggle — see ThemeToggle.jsx ─────────────────
export function NotifToggle({ variant = "drawer" }) {
  const { t } = useTranslation()
  const { supported, subscribed, loading, subscribe, unsubscribe, needsIosInstall } = usePushNotifications()
  const [iosHint, setIosHint] = useState(false)

  // Hide completely on browsers that can never support push (iOS Chrome, Firefox on iOS)
  if (!supported && !needsIosInstall) return null

  async function handleClick() {
    if (needsIosInstall) { setIosHint(true); return }
    // Carry saved team preferences so re-subscribe keeps the same scope
    const saved = (() => { try { return JSON.parse(localStorage.getItem("push_sub_teams") || "[]") } catch { return [] } })()
    if (subscribed) await unsubscribe()
    else await subscribe(saved)
  }

  if (variant === "desktop") {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          disabled={loading}
          title={subscribed ? t("push.disable") : needsIosInstall ? t("push.installForNotif") : t("push.enableShort")}
          className={`notif-toggle${subscribed ? " notif-toggle--on" : ""}`}
        >
          {subscribed ? "🔔" : "🔕"}
        </button>
        {iosHint && <IosInstallHint onClose={() => setIosHint(false)} />}
      </>
    )
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading}
        className="mobile-quick-item"
        style={{ background: subscribed ? "rgba(238,30,70,.12)" : undefined, borderColor: subscribed ? "var(--accent)" : undefined, color: subscribed ? "#fff" : undefined, cursor: "pointer", border: "1px solid var(--border)" }}
      >
        <span className="mobile-quick-icon">{subscribed ? "🔔" : "🔕"}</span>
        <span>{subscribed ? t("push.notifOn") : needsIosInstall ? t("push.installApp") : t("push.notifOff")}</span>
      </button>
      {iosHint && <IosInstallHint onClose={() => setIosHint(false)} />}
    </>
  )
}

// ─── iOS install hint modal ───────────────────────────────────────────────────
function IosInstallHint({ onClose }) {
  const { t } = useTranslation()
  return (
    <>
      <div {...dismissOverlayProps(onClose, t("a11y.dismiss"))} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 4000, backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
        width: "min(360px, 90vw)", zIndex: 4001,
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 16, padding: "20px 20px 16px", boxShadow: "0 16px 48px rgba(0,0,0,.6)",
      }}>
        <div style={{ fontSize: "1.8rem", textAlign: "center", marginBottom: 10 }}>📲</div>
        <div style={{ fontWeight: 800, color: "var(--text)", fontSize: "0.95rem", textAlign: "center", marginBottom: 8 }}>
          {t("push.iosInstallTitle")}
        </div>
        <div style={{ fontSize: "0.8rem", color: "var(--muted)", textAlign: "center", lineHeight: 1.5, marginBottom: 16 }}>
          {t("push.iosInstallBody")}
        </div>
        <button
          onClick={onClose}
          style={{ width: "100%", background: "var(--accent)", border: "none", borderRadius: 10, padding: "10px", color: "#fff", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer" }}
        >
          {t("push.iosInstallOk")}
        </button>
      </div>
    </>
  )
}

function NotifQuickItem() { return <NotifToggle variant="drawer" /> }

// ─── Icons ────────────────────────────────────────────
const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
)

// ─── Mega-menu: Mundial 2026 ──────────────────────────
const MundialMegaMenu = memo(function MundialMegaMenu({ t }) {
  return (
    <div className="mega-menu">
      <div className="mega-menu__col">
        <div className="mega-menu__section-label">{t("nav.mundial")}</div>
        <NavLink to="/mundial/teams"    className={({ isActive }) => `mega-menu__link${isActive ? " active" : ""}`}>
          <span className="mega-menu__link-icon">🏟️</span> {t("nav.teams")}
        </NavLink>
        <NavLink to="/mundial/schedule" className={({ isActive }) => `mega-menu__link${isActive ? " active" : ""}`}>
          <span className="mega-menu__link-icon">📅</span> {t("nav.schedule")}
        </NavLink>
        <NavLink to="/mundial/venues"   className={({ isActive }) => `mega-menu__link${isActive ? " active" : ""}`}>
          <span className="mega-menu__link-icon">🗺️</span> {t("nav.venues")}
        </NavLink>
        <NavLink to="/mundial/scorers"  className={({ isActive }) => `mega-menu__link${isActive ? " active" : ""}`}>
          <span className="mega-menu__link-icon">⚽</span> {t("nav.topScorers")}
        </NavLink>
        <div className="mega-menu__divider" />
        <NavLink to="/mundial/groups"   className={({ isActive }) => `mega-menu__link${isActive ? " active" : ""}`}>
          <span className="mega-menu__link-icon">📊</span> {t("nav.groupStage")}
        </NavLink>
        <NavLink to="/mundial/knockout" className={({ isActive }) => `mega-menu__link${isActive ? " active" : ""}`}>
          <span className="mega-menu__link-icon">🏆</span> {t("nav.knockout")}
        </NavLink>
      </div>
    </div>
  )
})

const LeaguesDropdown = memo(function LeaguesDropdown({ t }) {
  return (
    <div className="dropdown-menu-custom">
      <NavLink to="/leagues" className={({ isActive }) => `dropdown-item-custom${isActive ? " active" : ""}`}>
        {t("nav.allLeagues")}
      </NavLink>
      <div className="dd-separator" />
      {NAV_LEAGUES.map(({ emoji, key, path }) => (
        <NavLink key={path} to={path} className={({ isActive }) => `dropdown-item-custom${isActive ? " active" : ""}`}>
          <span className="dd-icon">{emoji}</span> {t(key)}
        </NavLink>
      ))}
    </div>
  )
})

// ─── Mobile group grid ────────────────────────────────
const MobileGroupGrid = memo(function MobileGroupGrid() {
  const { t } = useTranslation()
  return (
    <div style={{ padding: "10px 16px 14px" }}>
      <div style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
        {t("nav.groups")}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
        {GROUPS.map(g => (
          <NavLink
            key={g}
            to={`/groups/${g}`}
            className={({ isActive }) => `mobile-group-pill${isActive ? " active" : ""}`}
          >
            {g}
          </NavLink>
        ))}
      </div>
      <NavLink
        to="/groups"
        style={{ display: "block", textAlign: "center", marginTop: 10, fontSize: "0.75rem", color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}
      >
        {t("nav.allGroups")}
      </NavLink>
    </div>
  )
})

// ─── Mobile accordion section ─────────────────────────
const MobileSection = memo(function MobileSection({ label, sectionKey, expanded, onToggle, children, badge }) {
  const isOpen = expanded[sectionKey]
  return (
    <div className="mobile-nav-item">
      <button className="mobile-nav-parent" onClick={() => onToggle(sectionKey)}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {label}
          {badge > 0 && <span className="live-dot" />}
        </span>
        <span className={`mobile-arrow${isOpen ? " open" : ""}`}>▼</span>
      </button>
      {isOpen && <div className="mobile-nav-children">{children}</div>}
    </div>
  )
})

// ─── Main Navbar ──────────────────────────────────────
export default function Navbar() {
  const location  = useLocation()
  const { t }     = useTranslation()
  const liveCount = useLiveCount()
  const { clubs_primary: clubsPrimary } = useAppFocus()
  const brandSubtitle = clubsPrimary ? t("hero.clubBadge") : t("nav.mundialShort")
  const [searchOpen, setSearchOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [prefsOpen, setPrefsOpen]   = useState(false)
  const [expanded, setExpanded]     = useState({})
  const searchTriggerRef = useRef(null)

  const openSearch = useCallback((e) => {
    searchTriggerRef.current = e.currentTarget
    setSearchOpen(true)
  }, [])

  useEffect(() => { setDrawerOpen(false); setSearchOpen(false) }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : ""
    return () => { document.body.style.overflow = "" }
  }, [drawerOpen])

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setSearchOpen(s => !s)
      }
      if (e.key === "Escape") { setDrawerOpen(false); setSearchOpen(false) }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const toggle = useCallback((key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] })), [])

  // Mobile sections
  const MOBILE_MUNDIAL = [
    { label: t("nav.teams"),      path: "/mundial/teams",      emoji: "🏟️" },
    { label: t("nav.schedule"),   path: "/mundial/schedule",   emoji: "📅" },
    { label: t("nav.venues"),     path: "/mundial/venues",     emoji: "🗺️" },
    { label: t("nav.topScorers"), path: "/mundial/scorers",    emoji: "⚽" },
  ]
  const MOBILE_LEAGUES = [
    { label: t("nav.allLeagues"), path: "/leagues", emoji: "🌍" },
    ...NAV_LEAGUES.map(({ emoji, key, path }) => ({ label: t(key), path, emoji })),
  ]

  return (
    <>
      {searchOpen && <SearchBar onClose={() => setSearchOpen(false)} returnFocusRef={searchTriggerRef} />}

      {/* Drawer overlay */}
      {drawerOpen && <div className="mobile-overlay" {...dismissOverlayProps(() => setDrawerOpen(false), t("a11y.close"))} />}

      {/* Mobile drawer */}
      <div className={`site-mobile-menu${drawerOpen ? " mobile-menu-open" : ""}`}>
        {/* Drawer header */}
        <div className="site-mobile-menu-header">
          <Link to="/" style={{ flex: 1, textDecoration: "none", display: "flex", alignItems: "center", gap: 9 }}>
            <img src="/images/icon-192.png" alt="Golazo" style={{ height: 38, width: 38, borderRadius: 9, objectFit: "cover" }} />
            <div>
              <div style={{ fontWeight: 900, fontSize: "1rem", color: "var(--text)", letterSpacing: 2 }}>GOLAZO</div>
              <div style={{ fontSize: ".5rem", color: "var(--accent)", letterSpacing: 2, textTransform: "uppercase" }}>{brandSubtitle}</div>
            </div>
          </Link>
          {/* Search in drawer */}
          <button
            onClick={(e) => { searchTriggerRef.current = e.currentTarget; setDrawerOpen(false); setSearchOpen(true) }}
            aria-label={t("a11y.search")}
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 8, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginRight: 8, flexShrink: 0 }}
          >
            <SearchIcon />
          </button>
          <button className="site-mobile-menu-close" onClick={() => setDrawerOpen(false)} aria-label={t("a11y.close")}>✕</button>
        </div>

        {/* Drawer nav */}
        <nav className="mobile-drawer-nav">

          {/* Quick-access grid */}
          <div className="mobile-quick-grid">
            <NavLink to="/" end className={({ isActive }) => `mobile-quick-item${isActive ? " active" : ""}`}>
              <span className="mobile-quick-icon">🏠</span>
              <span>{t("nav.home")}</span>
            </NavLink>
            <NavLink to="/scores/today" className={({ isActive }) => `mobile-quick-item${isActive ? " active" : ""}`}>
              <span className="mobile-quick-icon" style={{ position: "relative", display: "inline-block" }}>
                ⏱️{liveCount > 0 && <span className="live-dot" style={{ position: "absolute", top: -2, right: -4 }} />}
              </span>
              <span>{t("time.today")}</span>
            </NavLink>
            <NavLink to="/news" className={({ isActive }) => `mobile-quick-item${isActive ? " active" : ""}`}>
              <span className="mobile-quick-icon">📰</span>
              <span>{t("nav.news")}</span>
            </NavLink>
            <NotifQuickItem />
          </div>

          <div className="mobile-drawer-divider">{t("nav.leagues", "Ligas")}</div>

          {/* Leagues section */}
          <div className="mobile-link-group">
            {MOBILE_LEAGUES.map(item => (
              <NavLink key={item.path} to={item.path} className={({ isActive }) => `mobile-drawer-link${isActive ? " active" : ""}`}>
                {item.emoji && <span className="mobile-drawer-link__icon" aria-hidden="true">{item.emoji}</span>}
                {item.label}
              </NavLink>
            ))}
          </div>

          {clubsPrimary && (
            <>
              <div className="mobile-drawer-divider">{t("teamComparison.title")}</div>
              <div className="mobile-link-group">
                <NavLink to="/compare/teams" className={({ isActive }) => `mobile-drawer-link${isActive ? " active" : ""}`}>
                  <span className="mobile-drawer-link__icon" aria-hidden="true">⚔️</span>
                  {t("teamComparison.compare")}
                </NavLink>
              </div>
            </>
          )}

          {!clubsPrimary && (
            <>
          <div className="mobile-drawer-divider">{t("nav.mundial")}</div>

          {/* Mundial section */}
          <div className="mobile-link-group">
            {MOBILE_MUNDIAL.map(item => (
              <NavLink key={item.path} to={item.path} className={({ isActive }) => `mobile-drawer-link${isActive ? " active" : ""}`}>
                {item.emoji && <span className="mobile-drawer-link__icon" aria-hidden="true">{item.emoji}</span>}
                {item.label}
              </NavLink>
            ))}
            <NavLink to="/scores/groups" className={({ isActive }) => `mobile-drawer-link${isActive ? " active" : ""}`}>
              <span className="mobile-drawer-link__icon" aria-hidden="true">📊</span>
              {t("nav.groupStage")}
            </NavLink>
            <NavLink to="/scores/knockout" className={({ isActive }) => `mobile-drawer-link${isActive ? " active" : ""}`}>
              <span className="mobile-drawer-link__icon" aria-hidden="true">🏆</span>
              {t("nav.knockout")}
            </NavLink>
          </div>
            </>
          )}

          {!clubsPrimary && (
            <>
          <div className="mobile-drawer-divider">{t("nav.groups")}</div>
          <MobileGroupGrid />
            </>
          )}

          <div className="mobile-drawer-divider">{t("preferences.title")}</div>
          <div className="mobile-link-group">
            <button
              type="button"
              className="mobile-drawer-link"
              onClick={() => { setDrawerOpen(false); setPrefsOpen(true) }}
            >
              <span className="mobile-drawer-link__icon" aria-hidden="true">⚙️</span>
              {t("preferences.title")}
            </button>
          </div>

          <div style={{ height: 80 }} />
        </nav>

        <div className="mobile-drawer-footer" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <ThemeToggle />
          <LanguageSwitcher />
        </div>
      </div>

      {/* ── Desktop header ── */}
      <header className="site-navbar" role="banner">
        <div className="container">
          <div className="d-flex align-items-center">

            {/* Logo */}
            <Link to="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", flexShrink: 0 }}>
              <img src="/images/icon-192.png" alt="Golazo" style={{ height: 46, width: 46, borderRadius: 12, objectFit: "cover" }} />
              <div style={{ marginLeft: 9 }}>
                <div style={{ fontWeight: 900, fontSize: "1.1rem", color: "var(--text)", letterSpacing: 2, lineHeight: 1.1 }}>GOLAZO</div>
                <div style={{ fontSize: ".5rem", color: "var(--accent)", letterSpacing: 2, textTransform: "uppercase" }}>{brandSubtitle}</div>
              </div>
            </Link>

            {/* Desktop nav */}
            <nav className="ml-auto d-none d-lg-flex align-items-center" style={{ gap: 2 }}>

              <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
                {t("nav.home")}
              </NavLink>

              {/* Live Matches */}
              <NavLink to="/scores/today" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
                {t(clubsPrimary ? "time.today" : "nav.liveMatches")}
                {liveCount > 0 && <span className="live-dot" style={{ marginLeft: 5, verticalAlign: "middle" }} />}
              </NavLink>

              {/* Leagues dropdown */}
              <div className="nav-item has-dropdown">
                <NavLink to="/leagues" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
                  {t("nav.leagues", "Leagues")}
                  <span className="nav-chevron">▼</span>
                </NavLink>
                <LeaguesDropdown t={t} />
              </div>

              {/* Mundial 2026 (mega-menu) — archived in clubs mode */}
              {!clubsPrimary && (
              <div className="nav-item has-mega">
                <NavLink to="/mundial" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
                  {t("nav.mundial")}
                  <span className="nav-chevron">▼</span>
                </NavLink>
                <MundialMegaMenu t={t} />
              </div>
              )}

              <NavLink to="/news" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
                {t("nav.news")}
              </NavLink>

              {clubsPrimary && (
                <NavLink to="/compare/teams" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
                  {t("teamComparison.compare")}
                </NavLink>
              )}

              {/* Search */}
              <button
                onClick={openSearch}
                title={t("a11y.searchShortcut")}
                aria-label={t("a11y.searchShortcut")}
                className="nav-search-btn"
              >
                <SearchIcon />
                <kbd className="nav-search-kbd">⌘K</kbd>
              </button>

              <div style={{ marginLeft: 4, display: "flex", alignItems: "center", gap: 6 }}>
                <NotifToggle variant="desktop" />
                <ThemeToggle />
                <LanguageSwitcher />
              </div>
            </nav>

            {/* Mobile: search + theme toggle + hamburger */}
            <div className="mobile-header-actions ml-auto">
              <button
                onClick={openSearch}
                aria-label={t("a11y.search")}
                style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 0, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <SearchIcon />
              </button>
              <ThemeToggle />
              <button className="mobile-toggle" onClick={() => setDrawerOpen(true)} aria-label={t("a11y.openMenu")}>
                ☰
              </button>
            </div>

          </div>
        </div>
      </header>
      <PreferencesSheet open={prefsOpen} onClose={() => setPrefsOpen(false)} />
    </>
  )
}
