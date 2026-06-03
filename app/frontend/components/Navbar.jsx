import { useState, useEffect } from "react"

export default function Navbar({ activeTab, onTabChange }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [shrink, setShrink] = useState(false)

  useEffect(() => {
    const onScroll = () => setShrink(window.scrollY > 50)
    window.addEventListener("scroll", onScroll)
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const toggle = () => {
    setMenuOpen(o => {
      const next = !o
      document.body.classList.toggle("offcanvas-menu", next)
      return next
    })
  }
  const close = () => {
    setMenuOpen(false)
    document.body.classList.remove("offcanvas-menu")
  }

  const navItems = [
    { key: "home", label: "Home" },
    { key: "matches", label: "Matches" },
    { key: "groups", label: "Groups" },
  ]

  return (
    <>
      {/* Mobile menu */}
      <div className={`site-mobile-menu site-navbar-target${menuOpen ? " active" : ""}`}>
        <div className="site-mobile-menu-header">
          <div className="site-mobile-menu-close">
            <span className="icon-close2" onClick={close} style={{ cursor: "pointer" }} />
          </div>
        </div>
        <div className="site-mobile-menu-body">
          <ul className="site-nav-wrap" style={{ paddingLeft: 0, listStyle: "none", marginTop: "3rem" }}>
            {navItems.map(item => (
              <li key={item.key} className={activeTab === item.key ? "active" : ""}>
                <a
                  href="#"
                  className="nav-link"
                  onClick={e => { e.preventDefault(); onTabChange(item.key); close() }}
                  style={{ display: "block", padding: "10px 20px", color: "rgba(255,255,255,0.7)", fontSize: "15px" }}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Header */}
      <header className={`site-navbar py-4${shrink ? " shrink" : ""}`} role="banner">
        <div className="container">
          <div className="d-flex align-items-center">
            <div className="site-logo">
              <a href="#" onClick={e => { e.preventDefault(); onTabChange("home") }}>
                <span style={{ fontFamily: "Montserrat", fontWeight: 900, fontSize: "1.4rem", color: "#fff", letterSpacing: 2 }}>
                  ⚽ GOLAZO
                </span>
              </a>
            </div>
            <div className="ml-auto">
              <nav className="site-navigation position-relative text-right" role="navigation">
                <ul className="site-menu main-menu mr-auto d-none d-lg-block">
                  {navItems.map(item => (
                    <li key={item.key} className={activeTab === item.key ? "active" : ""}>
                      <a
                        href="#"
                        className="nav-link"
                        onClick={e => { e.preventDefault(); onTabChange(item.key) }}
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
              <button
                className="d-inline-block d-lg-none site-menu-toggle"
                onClick={toggle}
                style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}
              >
                <span className="icon-menu h3 text-white" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Overlay to close mobile menu */}
      {menuOpen && (
        <div
          onClick={close}
          style={{ position: "fixed", inset: 0, zIndex: 998, background: "rgba(0,0,0,0.4)" }}
        />
      )}
    </>
  )
}
