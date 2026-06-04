import { useEffect, useRef, useState } from "react"
import { Link, NavLink, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import LanguageSwitcher from "./LanguageSwitcher"
import SearchBar from "./SearchBar"
import { useLiveCount } from "../contexts/LiveContext"

const GROUPS = Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i))

// ─── Icons ────────────────────────────────────────────
const SearchIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
)

// ─── Mega-menu: Mundial 2026 ──────────────────────────
function MundialMegaMenu({ t }) {
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
        <NavLink to="/scores/groups"    className={({ isActive }) => `mega-menu__link${isActive ? " active" : ""}`}>
          <span className="mega-menu__link-icon">📊</span> Group Stage
        </NavLink>
        <NavLink to="/scores/knockout"  className={({ isActive }) => `mega-menu__link${isActive ? " active" : ""}`}>
          <span className="mega-menu__link-icon">🏆</span> {t("nav.knockout")}
        </NavLink>
      </div>

      <div className="mega-menu__col mega-menu__col--groups">
        <div className="mega-menu__section-label">
          Groups
          <NavLink to="/groups" style={{ marginLeft: "auto", fontSize: "0.68rem", color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>
            All →
          </NavLink>
        </div>
        <div className="mega-menu__group-grid">
          {GROUPS.map(g => (
            <NavLink
              key={g}
              to={`/groups/${g}`}
              className={({ isActive }) => `mega-menu__group-pill${isActive ? " active" : ""}`}
            >
              {g}
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  )
}


function LeaguesDropdown({ t }) {
  return (
    <div className="dropdown-menu-custom">
      <NavLink to="/leagues" className={({ isActive }) => `dropdown-item-custom${isActive ? " active" : ""}`}>
        All Leagues
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
      ].map(({ label, path, flag }) => (
        <NavLink key={path} to={path} className={({ isActive }) => `dropdown-item-custom${isActive ? " active" : ""}`}>
          <span className="dd-icon">{flag}</span> {label}
        </NavLink>
      ))}
    </div>
  )
}

// ─── Mobile group grid ────────────────────────────────
function MobileGroupGrid() {
  return (
    <div style={{ padding: "10px 16px 14px" }}>
      <div style={{ fontSize: "0.6rem", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 8 }}>
        Groups
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
        All Groups →
      </NavLink>
    </div>
  )
}

// ─── Main Navbar ──────────────────────────────────────
export default function Navbar() {
  const location  = useLocation()
  const { t }     = useTranslation()
  const liveCount = useLiveCount()
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

  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

  // Mobile sections
  const MOBILE_MUNDIAL = [
    { label: t("nav.teams"),      path: "/mundial/teams" },
    { label: t("nav.schedule"),   path: "/mundial/schedule" },
    { label: t("nav.venues"),     path: "/mundial/venues" },
    { label: t("nav.topScorers"), path: "/mundial/scorers" },
  ]
  const MOBILE_LEAGUES = [
    { label: "All Leagues",       path: "/leagues" },
    { label: "Premier League",    path: "/leagues/PL" },
    { label: "La Liga",           path: "/leagues/LAL" },
    { label: "Bundesliga",        path: "/leagues/BL1" },
    { label: "Serie A",           path: "/leagues/SA" },
    { label: "Ligue 1",           path: "/leagues/L1" },
    { label: "Champions League",  path: "/leagues/UCL" },
    { label: "MLS",               path: "/leagues/MLS" },
  ]

  function MobileSection({ label, sectionKey, children, badge }) {
    const isOpen = expanded[sectionKey]
    return (
      <div className="mobile-nav-item">
        <button className="mobile-nav-parent" onClick={() => toggle(sectionKey)}>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {label}
            {badge > 0 && <span className="live-dot" />}
          </span>
          <span className={`mobile-arrow${isOpen ? " open" : ""}`}>▼</span>
        </button>
        {isOpen && <div className="mobile-nav-children">{children}</div>}
      </div>
    )
  }

  return (
    <>
      {searchOpen && <SearchBar onClose={() => setSearchOpen(false)} />}

      {/* Drawer overlay */}
      {drawerOpen && <div className="mobile-overlay" onClick={() => setDrawerOpen(false)} />}

      {/* Mobile drawer */}
      <div className={`site-mobile-menu${drawerOpen ? " mobile-menu-open" : ""}`}>
        {/* Drawer header */}
        <div className="site-mobile-menu-header">
          <Link to="/" style={{ flex: 1, textDecoration: "none", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: "1.4rem" }}>⚽</span>
            <div>
              <div style={{ fontWeight: 900, fontSize: "1rem", color: "#fff", letterSpacing: 2 }}>GOLAZO</div>
              <div style={{ fontSize: ".52rem", color: "var(--accent)", letterSpacing: 2, textTransform: "uppercase" }}>Mundial 2026</div>
            </div>
          </Link>
          {/* Search in drawer */}
          <button
            onClick={() => { setDrawerOpen(false); setSearchOpen(true) }}
            style={{ background: "var(--surface2)", border: "1px solid var(--border)", color: "var(--muted)", borderRadius: 8, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", marginRight: 8 }}
          >
            <SearchIcon />
          </button>
          <button className="site-mobile-menu-close" onClick={() => setDrawerOpen(false)} aria-label="Close">✕</button>
        </div>

        {/* Drawer nav */}
        <nav style={{ flex: 1, overflowY: "auto", paddingBottom: 16 }}>
          {/* Home */}
          <div className="mobile-nav-item">
            <NavLink to="/" end className={({ isActive }) => `mobile-nav-parent${isActive ? " active" : ""}`} style={{ textDecoration: "none" }}>
              {t("nav.home")}
            </NavLink>
          </div>

          {/* Live Matches */}
          <div className="mobile-nav-item">
            <NavLink to="/scores/today" className={({ isActive }) => `mobile-nav-parent${isActive ? " active" : ""}`} style={{ textDecoration: "none" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {t("nav.liveMatches", "Live Matches")}
                {liveCount > 0 && <span className="live-dot" />}
              </span>
            </NavLink>
          </div>

          {/* Mundial */}
          <MobileSection label="Mundial 2026" sectionKey="mundial">
            {MOBILE_MUNDIAL.map(item => (
              <NavLink key={item.path} to={item.path} className={({ isActive }) => `mobile-nav-child${isActive ? " active" : ""}`}>
                {item.label}
              </NavLink>
            ))}
            <MobileGroupGrid />
          </MobileSection>

          {/* Leagues */}
          <MobileSection label={t("nav.allLeagues")} sectionKey="leagues">
            {MOBILE_LEAGUES.map(item => (
              <NavLink key={item.path} to={item.path} className={({ isActive }) => `mobile-nav-child${isActive ? " active" : ""}`}>
                {item.label}
              </NavLink>
            ))}
          </MobileSection>

          {/* News */}
          <div className="mobile-nav-item">
            <NavLink to="/news" className={({ isActive }) => `mobile-nav-parent${isActive ? " active" : ""}`} style={{ textDecoration: "none" }}>
              {t("nav.news")}
            </NavLink>
          </div>
        </nav>

        <div style={{ padding: "14px 20px", borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <LanguageSwitcher />
          <span style={{ fontSize: "0.68rem", color: "#333" }}>⌘K to search</span>
        </div>
      </div>

      {/* ── Desktop header ── */}
      <header className="site-navbar" role="banner">
        <div className="container">
          <div className="d-flex align-items-center">

            {/* Logo */}
            <Link to="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <span style={{ fontSize: "1.6rem", lineHeight: 1 }}>⚽</span>
              <div>
                <div style={{ fontWeight: 900, fontSize: "1.15rem", color: "#fff", letterSpacing: 2, lineHeight: 1.1 }}>GOLAZO</div>
                <div style={{ fontSize: ".52rem", color: "var(--accent)", letterSpacing: 2, textTransform: "uppercase" }}>Mundial 2026</div>
              </div>
            </Link>

            {/* Desktop nav */}
            <nav className="ml-auto d-none d-lg-flex align-items-center" style={{ gap: 2 }}>

              <NavLink to="/" end className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
                {t("nav.home")}
              </NavLink>

              {/* Live Matches */}
              <NavLink to="/scores/today" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
                {t("nav.liveMatches", "Live Matches")}
                {liveCount > 0 && <span className="live-dot" style={{ marginLeft: 5, verticalAlign: "middle" }} />}
              </NavLink>

              {/* Mundial 2026 (mega-menu) */}
              <div className="nav-item has-mega">
                <NavLink to="/mundial" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
                  Mundial 2026
                  <span className="nav-chevron">▼</span>
                </NavLink>
                <MundialMegaMenu t={t} />
              </div>

              {/* Leagues */}
              <div className="nav-item has-dropdown">
                <NavLink to="/leagues" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
                  {t("nav.allLeagues")}
                  <span className="nav-chevron">▼</span>
                </NavLink>
                <LeaguesDropdown t={t} />
              </div>

              <NavLink to="/news" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
                {t("nav.news")}
              </NavLink>

              {/* Search */}
              <button
                onClick={() => setSearchOpen(true)}
                title="Search (⌘K)"
                className="nav-search-btn"
              >
                <SearchIcon />
                <kbd className="nav-search-kbd">⌘K</kbd>
              </button>

              <div style={{ marginLeft: 4 }}>
                <LanguageSwitcher />
              </div>
            </nav>

            {/* Mobile: search + hamburger */}
            <div className="d-lg-none ml-auto" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={() => setSearchOpen(true)}
                style={{ background: "none", border: "none", color: "var(--muted)", cursor: "pointer", padding: 6, display: "flex" }}
              >
                <SearchIcon />
              </button>
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
