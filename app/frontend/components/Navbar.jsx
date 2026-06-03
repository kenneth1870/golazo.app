import { useEffect } from "react"
import { Link, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import LanguageSwitcher from "./LanguageSwitcher"

export default function Navbar() {
  const location = useLocation()
  const { t } = useTranslation()

  const NAV_ITEMS = [
    { label: t("nav.home"),       path: "/" },
    {
      label: t("nav.scores"),     path: "/scores",
      children: [
        { label: t("nav.live"),       path: "/scores/live" },
        { label: t("nav.results"),    path: "/scores/results" },
        { label: t("nav.fixtures"),   path: "/scores/fixtures" },
        { label: t("nav.groupStage"), path: "/scores/groups" },
        { label: t("nav.knockout"),   path: "/scores/knockout" },
      ]
    },
    {
      label: t("nav.groups"),     path: "/groups",
      children: Array.from({ length: 12 }, (_, i) => {
        const g = String.fromCharCode(65 + i)
        return { label: t("nav.group", { letter: g }), path: `/groups/${g}` }
      })
    },
    {
      label: t("nav.mundial"),    path: "/mundial",
      children: [
        { label: t("nav.teams"),      path: "/mundial/teams" },
        { label: t("nav.schedule"),   path: "/mundial/schedule" },
        { label: t("nav.venues"),     path: "/mundial/venues" },
        { label: t("nav.topScorers"), path: "/mundial/scorers" },
      ]
    },
    { label: t("nav.allLeagues"), path: "/leagues" },
    { label: t("nav.news"),       path: "/news" },
  ]

  // Re-init jQuery mobile menu after React renders
  useEffect(() => {
    if (window.jQuery) {
      const $ = window.jQuery
      $(".site-mobile-menu-body").empty()
      $(".js-clone-nav").clone().attr("class", "site-nav-wrap").appendTo(".site-mobile-menu-body")
    }
  }, [location.pathname, t])  // re-clone when language changes too

  const isActive = (path) => {
    if (path === "/") return location.pathname === "/"
    return location.pathname.startsWith(path)
  }

  return (
    <>
      {/* Mobile menu — jQuery clones .js-clone-nav here */}
      <div className="site-mobile-menu site-navbar-target">
        <div className="site-mobile-menu-header">
          <div className="site-mobile-menu-close">
            <span className="icon-close2 js-menu-toggle" />
          </div>
        </div>
        <div className="site-mobile-menu-body" />
      </div>

      {/* Header */}
      <header className="site-navbar js-sticky-header py-4" role="banner">
        <div className="container">
          <div className="d-flex align-items-center">

            <div className="site-logo">
              <Link to="/">
                <span style={{ fontFamily: "Montserrat", fontWeight: 900, fontSize: "1.3rem", color: "#fff", letterSpacing: 2 }}>
                  ⚽ GOLAZO
                </span>
                <span style={{ display: "block", fontSize: ".58rem", color: "#ee1e46", letterSpacing: 2, textTransform: "uppercase" }}>
                  Mundial 2026
                </span>
              </Link>
            </div>

            <div className="ml-auto d-flex align-items-center" style={{ gap: 12 }}>
              <nav className="site-navigation position-relative text-right" role="navigation">
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

              {/* Language switcher — desktop */}
              <div className="d-none d-lg-block">
                <LanguageSwitcher />
              </div>

              {/* Mobile hamburger */}
              <a
                href="#"
                className="d-inline-block d-lg-none site-menu-toggle js-menu-toggle text-white"
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
