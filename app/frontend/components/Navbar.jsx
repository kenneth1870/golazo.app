import { useEffect, useRef, useState, memo, useCallback, Fragment } from "react"
import { Link, NavLink, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import LanguageSwitcher from "./LanguageSwitcher"
import SearchBar from "./SearchBar"
import { useLiveCount } from "../contexts/LiveContext"
import { usePushNotifications } from "../hooks/usePushNotifications"
import { useAppFocus } from "../hooks/useAppFocus"
import { CLUB_CHIPS } from "./ClubCompetitionChips"

const GROUPS = Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i))

// ─── Theme toggle ─────────────────────────────────────
function ThemeToggle() {
  const [light, setLight] = useState(() => {
    try { return localStorage.getItem("golazo_theme") === "light" } catch { return false }
  })
  useEffect(() => {
    document.body.classList.toggle("light-mode", light)
    try { localStorage.setItem("golazo_theme", light ? "light" : "dark") } catch {}
  }, [light])
  return (
    <button
      onClick={() => setLight(v => !v)}
      title={light ? "Switch to dark mode" : "Switch to light mode"}
      style={{
        background: "none", border: "1px solid var(--border)",
        borderRadius: 8, width: 32, height: 32,
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", fontSize: "0.9rem", color: "var(--muted)",
        transition: "border-color .2s, color .2s", flexShrink: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,.25)"; e.currentTarget.style.color = "#fff" }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--muted)" }}
    >
      {light ? "☀️" : "🌙"}
    </button>
  )
}

// ─── Notification toggle — shared between mobile drawer and desktop nav ──────
export function NotifToggle({ variant = "drawer" }) {
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
          onClick={handleClick}
          disabled={loading}
          title={subscribed ? "Desactivar notificaciones" : needsIosInstall ? "Instala la app para recibir notificaciones" : "Activar notificaciones de goles"}
          style={{
            background: subscribed ? "rgba(16,185,129,.15)" : "none",
            border: subscribed ? "1px solid rgba(16,185,129,.4)" : "1px solid var(--border)",
            borderRadius: 8, width: 32, height: 32,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", fontSize: "0.9rem", color: subscribed ? "#10b981" : "var(--muted)",
            transition: "border-color .2s, color .2s", flexShrink: 0, opacity: loading ? 0.5 : 1,
          }}
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
        <span>{subscribed ? "Notif. On" : needsIosInstall ? "Instalar app" : "Notif. Off"}</span>
      </button>
      {iosHint && <IosInstallHint onClose={() => setIosHint(false)} />}
    </>
  )
}

// ─── iOS install hint modal ───────────────────────────────────────────────────
function IosInstallHint({ onClose }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 4000, backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)",
        width: "min(360px, 90vw)", zIndex: 4001,
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 16, padding: "20px 20px 16px", boxShadow: "0 16px 48px rgba(0,0,0,.6)",
      }}>
        <div style={{ fontSize: "1.8rem", textAlign: "center", marginBottom: 10 }}>📲</div>
        <div style={{ fontWeight: 800, color: "var(--text)", fontSize: "0.95rem", textAlign: "center", marginBottom: 8 }}>
          Añade Golazo a tu inicio
        </div>
        <div style={{ fontSize: "0.8rem", color: "var(--muted)", textAlign: "center", lineHeight: 1.5, marginBottom: 16 }}>
          Para recibir alertas de goles en iOS, primero instala la app:
          toca <strong style={{ color: "var(--text)" }}>Compartir</strong> (□↑) y luego{" "}
          <strong style={{ color: "var(--text)" }}>Añadir a pantalla de inicio</strong>.
        </div>
        <button
          onClick={onClose}
          style={{ width: "100%", background: "var(--accent)", border: "none", borderRadius: 10, padding: "10px", color: "#fff", fontWeight: 700, fontSize: "0.88rem", cursor: "pointer" }}
        >
          Entendido
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
        <div className="mega-menu__section-label">Mundial 2026</div>
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
      {[
        { label: "Premier League",     path: "/leagues/PL",  flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
        { label: "La Liga",            path: "/leagues/LAL", flag: "🇪🇸" },
        { label: "Bundesliga",         path: "/leagues/BL1", flag: "🇩🇪" },
        { label: "Serie A",            path: "/leagues/SA",  flag: "🇮🇹" },
        { label: "Ligue 1",            path: "/leagues/L1",  flag: "🇫🇷" },
        { label: "Champions League",   path: "/leagues/UCL", flag: "⭐" },
        { label: "MLS",                path: "/leagues/MLS", flag: "🇺🇸" },
        { label: "Liga Tica",          path: "/leagues/CRC", flag: "🇨🇷" },
        { label: "Liga MX",            path: "/leagues/LMX", flag: "🇲🇽" },
      ].map(({ label, path, flag }) => (
        <NavLink key={path} to={path} className={({ isActive }) => `dropdown-item-custom${isActive ? " active" : ""}`}>
          <span className="dd-icon">{flag}</span> {label}
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
  const [expanded, setExpanded]     = useState({})

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
    { label: t("nav.teams"),      path: "/mundial/teams" },
    { label: t("nav.schedule"),   path: "/mundial/schedule" },
    { label: t("nav.venues"),     path: "/mundial/venues" },
    { label: t("nav.topScorers"), path: "/mundial/scorers" },
  ]
  const MOBILE_LEAGUES = [
    { label: t("nav.allLeagues"), path: "/leagues" },
    ...CLUB_CHIPS.map(({ key, path }) => ({ label: t(key), path })),
    { label: t("clubs.mls"), path: "/leagues/MLS" },
  ]

  return (
    <>
      {searchOpen && <SearchBar onClose={() => setSearchOpen(false)} />}

      {/* Drawer overlay */}
      {drawerOpen && <div className="mobile-overlay" onClick={() => setDrawerOpen(false)} />}

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
            onClick={() => { setDrawerOpen(false); setSearchOpen(true) }}
            aria-label="Search"
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 8, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginRight: 8, flexShrink: 0 }}
          >
            <SearchIcon />
          </button>
          <button className="site-mobile-menu-close" onClick={() => setDrawerOpen(false)} aria-label="Close">✕</button>
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
                {item.label}
              </NavLink>
            ))}
          </div>

          <div className="mobile-drawer-divider">{t("nav.mundial", "Mundial 2026")}</div>

          {/* Mundial section */}
          <div className="mobile-link-group">
            {MOBILE_MUNDIAL.map(item => (
              <NavLink key={item.path} to={item.path} className={({ isActive }) => `mobile-drawer-link${isActive ? " active" : ""}`}>
                {item.label}
              </NavLink>
            ))}
            <NavLink to="/scores/groups" className={({ isActive }) => `mobile-drawer-link${isActive ? " active" : ""}`}>
              {t("nav.groupStage", "Fase de Grupos")}
            </NavLink>
            <NavLink to="/scores/knockout" className={({ isActive }) => `mobile-drawer-link${isActive ? " active" : ""}`}>
              {t("nav.knockout", "Eliminatorias")}
            </NavLink>
          </div>

          {!clubsPrimary && (
            <>
          <div className="mobile-drawer-divider">{t("nav.groups", "Grupos")}</div>
          <MobileGroupGrid />
            </>
          )}

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
                {t("nav.liveMatches")}
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

              {/* Mundial 2026 (mega-menu) */}
              <div className="nav-item has-mega">
                <NavLink to="/mundial" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
                  Mundial 2026
                  <span className="nav-chevron">▼</span>
                </NavLink>
                <MundialMegaMenu t={t} />
              </div>

              <NavLink to="/news" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
                {t("nav.news")}
              </NavLink>

              {/* Search */}
              <button
                onClick={() => setSearchOpen(true)}
                title="Search (⌘K)"
                aria-label="Search (⌘K)"
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
                onClick={() => setSearchOpen(true)}
                aria-label="Search"
                style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 0, width: 44, height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <SearchIcon />
              </button>
              <ThemeToggle />
              <button className="mobile-toggle" onClick={() => setDrawerOpen(true)} aria-label="Open menu">
                ☰
              </button>
            </div>

          </div>
        </div>
      </header>
    </>
  )
}
