import { useEffect } from "react"
import { Link, useLocation } from "react-router-dom"

const NAV_ITEMS = [
  { label: "Home",        path: "/" },
  {
    label: "Scores", path: "/scores",
    children: [
      { label: "Live Matches",    path: "/scores/live" },
      { label: "Results",         path: "/scores/results" },
      { label: "Fixtures",        path: "/scores/fixtures" },
      { label: "Group Stage",     path: "/scores/groups" },
      { label: "Knockout Rounds", path: "/scores/knockout" },
    ]
  },
  {
    label: "Groups", path: "/groups",
    children: Array.from({ length: 12 }, (_, i) => {
      const g = String.fromCharCode(65 + i)
      return { label: `Group ${g}`, path: `/groups/${g}` }
    })
  },
  {
    label: "Mundial 2026", path: "/mundial",
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
  const location = useLocation()

  // Re-init jQuery mobile menu after React renders (main.js runs before React mounts)
  useEffect(() => {
    if (window.jQuery) {
      const $ = window.jQuery
      // Re-clone nav into mobile menu body
      const $body = $(".site-mobile-menu-body")
      $body.empty()
      $(".js-clone-nav").clone().attr("class", "site-nav-wrap").appendTo($body)
    }
  }, [location.pathname])

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/"
    return location.pathname.startsWith(path)
  }

  return (
    <>
      {/* Mobile menu — populated by jQuery clone of js-clone-nav */}
      <div className="site-mobile-menu site-navbar-target">
        <div className="site-mobile-menu-header">
          <div className="site-mobile-menu-close">
            <span className="icon-close2 js-menu-toggle" />
          </div>
        </div>
        <div className="site-mobile-menu-body" />
      </div>

      {/* Header — js-sticky-header enables jQuery sticky + shrink */}
      <header className="site-navbar js-sticky-header py-4" role="banner">
        <div className="container">
          <div className="d-flex align-items-center">

            <div className="site-logo">
              <Link to="/">
                <span style={{ fontFamily: "Montserrat", fontWeight: 900, fontSize: "1.4rem", color: "#fff", letterSpacing: 2 }}>
                  ⚽ GOLAZO
                </span>
                <span style={{ display: "block", fontSize: "0.6rem", color: "#ee1e46", letterSpacing: 2, textTransform: "uppercase" }}>
                  Mundial 2026
                </span>
              </Link>
            </div>

            <div className="ml-auto">
              <nav className="site-navigation position-relative text-right" role="navigation">
                {/* js-clone-nav → cloned by jQuery into mobile menu */}
                <ul className="site-menu main-menu js-clone-nav mr-auto d-none d-lg-block">
                  {NAV_ITEMS.map(item => (
                    <li
                      key={item.path}
                      className={`${isActive(item.path) ? "active" : ""}${item.children ? " has-children" : ""}`}
                    >
                      <Link to={item.path} className="nav-link">{item.label}</Link>
                      {item.children && (
                        <ul className="dropdown">
                          {item.children.map(child => (
                            <li key={child.path} className={isActive(child.path) ? "active" : ""}>
                              <Link to={child.path} className="nav-link">{child.label}</Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>

              {/* js-menu-toggle → jQuery toggles offcanvas-menu on body */}
              <a
                href="#"
                className="d-inline-block d-lg-none site-menu-toggle js-menu-toggle text-white float-right"
                onClick={e => e.preventDefault()}
              >
                <span className="icon-menu h3 text-white" />
              </a>
            </div>
          </div>
        </div>
      </header>
    </>
  )
}
