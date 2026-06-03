import { useState, useEffect } from "react"
import { NavLink, useLocation } from "react-router-dom"

const NAV = [
  {
    label: "Scores",
    path: "/scores",
    children: [
      { label: "Live Matches",    path: "/scores/live" },
      { label: "Results",         path: "/scores/results" },
      { label: "Fixtures",        path: "/scores/fixtures" },
      { label: "Group Stage",     path: "/scores/groups" },
      { label: "Knockout Rounds", path: "/scores/knockout" },
    ]
  },
  {
    label: "Groups",
    path: "/groups",
    children: Array.from({ length: 12 }, (_, i) => ({
      label: `Group ${String.fromCharCode(65 + i)}`,
      path:  `/groups/${String.fromCharCode(65 + i)}`
    }))
  },
  {
    label: "Mundial 2026",
    path: "/mundial",
    children: [
      { label: "Teams",       path: "/mundial/teams" },
      { label: "Schedule",    path: "/mundial/schedule" },
      { label: "Venues",      path: "/mundial/venues" },
      { label: "Top Scorers", path: "/mundial/scorers" },
    ]
  },
  { label: "All Leagues", path: "/leagues" },
  { label: "News",        path: "/news" },
]

export default function Navbar() {
  const [mobileOpen, setMobileOpen]     = useState(false)
  const [openDropdown, setOpenDropdown] = useState(null)
  const [shrink, setShrink]             = useState(false)
  const location = useLocation()

  useEffect(() => {
    setMobileOpen(false)
    setOpenDropdown(null)
    document.body.classList.remove("offcanvas-menu")
  }, [location.pathname])

  useEffect(() => {
    const onScroll = () => setShrink(window.scrollY > 50)
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const toggleMobile = () => {
    setMobileOpen(o => {
      document.body.classList.toggle("offcanvas-menu", !o)
      return !o
    })
  }

  return (
    <>
      {/* Mobile side menu */}
      <div className={`site-mobile-menu${mobileOpen ? " mobile-menu-open" : ""}`}>
        <div className="site-mobile-menu-header">
          <div className="site-mobile-menu-close" onClick={() => { setMobileOpen(false); document.body.classList.remove("offcanvas-menu") }}>
            <span className="icon-close2" />
          </div>
        </div>
        <div className="site-mobile-menu-body">
          {NAV.map(item => (
            <div key={item.path} className="mobile-nav-item">
              {item.children ? (
                <>
                  <button
                    className="mobile-nav-parent"
                    onClick={() => setOpenDropdown(openDropdown === item.path ? null : item.path)}
                  >
                    {item.label}
                    <span className={`mobile-arrow${openDropdown === item.path ? " open" : ""}`}>▾</span>
                  </button>
                  {openDropdown === item.path && (
                    <div className="mobile-nav-children">
                      {item.children.map(c => (
                        <NavLink key={c.path} to={c.path} className="mobile-nav-child">{c.label}</NavLink>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <NavLink to={item.path} className="mobile-nav-parent">{item.label}</NavLink>
              )}
            </div>
          ))}
        </div>
      </div>

      <header className={`site-navbar py-3${shrink ? " shrink" : ""}`} role="banner">
        <div className="container">
          <div className="d-flex align-items-center">
            <div className="site-logo">
              <NavLink to="/" style={{ textDecoration: "none" }}>
                <span className="golazo-logo">⚽ GOLAZO</span>
                <span className="golazo-badge">Mundial 2026</span>
              </NavLink>
            </div>

            {/* Desktop nav */}
            <nav className="site-navigation ml-auto d-none d-lg-block">
              <ul className="site-menu main-menu d-flex" style={{ listStyle: "none", margin: 0, padding: 0, gap: "4px" }}>
                {NAV.map(item => (
                  <li key={item.path} className={`nav-item${item.children ? " has-dropdown" : ""}`}>
                    <NavLink to={item.path} className="nav-link">
                      {item.label}
                      {item.children && <span style={{ fontSize: "0.6rem", marginLeft: 3 }}>▾</span>}
                    </NavLink>
                    {item.children && (
                      <div className="dropdown-menu-custom">
                        {item.children.map(c => (
                          <NavLink key={c.path} to={c.path} className="dropdown-item-custom">{c.label}</NavLink>
                        ))}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </nav>

            {/* Mobile hamburger */}
            <button className="mobile-toggle d-lg-none ml-auto" onClick={toggleMobile}>
              <span className="icon-menu" />
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && <div className="mobile-overlay" onClick={() => { setMobileOpen(false); document.body.classList.remove("offcanvas-menu") }} />}
    </>
  )
}
