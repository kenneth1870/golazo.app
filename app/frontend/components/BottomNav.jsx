import { useState } from "react"
import { NavLink } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useLiveCount } from "../contexts/LiveContext"
import SearchBar from "./SearchBar"

const HomeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)
const TodayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
)
const MundialIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="2" y1="12" x2="22" y2="12"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
)
const SearchIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)

export default function BottomNav() {
  const { t }           = useTranslation()
  const liveCount       = useLiveCount()
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <>
      {searchOpen && <SearchBar onClose={() => setSearchOpen(false)} />}
      <nav className="bottom-nav" aria-label="Main navigation">
      <NavLink
        to="/"
        end
        className={({ isActive }) => `bottom-nav__item${isActive ? " bottom-nav__item--active" : ""}`}
      >
        <HomeIcon />
        <span className="bottom-nav__label">{t("nav.home")}</span>
      </NavLink>

      <NavLink
        to="/scores/today"
        className={({ isActive }) => `bottom-nav__item${isActive ? " bottom-nav__item--active" : ""}`}
      >
        <span className="bottom-nav__icon-wrap">
          <TodayIcon />
          {liveCount > 0 && <span className="bottom-nav__badge" />}
        </span>
        <span className="bottom-nav__label">{t("time.today")}</span>
      </NavLink>

      <NavLink
        to="/mundial"
        className={({ isActive }) => `bottom-nav__item${isActive ? " bottom-nav__item--active" : ""}`}
      >
        <MundialIcon />
        <span className="bottom-nav__label">{t("nav.mundial")}</span>
      </NavLink>

      <button
        className="bottom-nav__item bottom-nav__item--btn"
        onClick={() => setSearchOpen(true)}
        aria-label="Search"
      >
        <SearchIcon />
        <span className="bottom-nav__label">{t("nav.search")}</span>
      </button>
    </nav>
    </>
  )
}
