import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import LanguageSwitcher from "./LanguageSwitcher"
import { useAppFocus } from "../hooks/useAppFocus"


const SOCIAL = [
  {
    label: "Twitter / X",
    href:  "https://twitter.com",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.91-5.622Zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
  {
    label: "Instagram",
    href:  "https://instagram.com",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="2" y="2" width="20" height="20" rx="5"/>
        <circle cx="12" cy="12" r="5"/>
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none"/>
      </svg>
    ),
  },
  {
    label: "YouTube",
    href:  "https://youtube.com",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
  },
  {
    label: "Facebook",
    href:  "https://facebook.com",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
]

export default function Footer() {
  const { t } = useTranslation()
  const { clubs_primary: clubsPrimary } = useAppFocus()
  const brandSubtitle = clubsPrimary ? t("hero.clubBadge") : "Mundial 2026"

  return (
    <footer className="footer-section">
      <div className="container">

        {/* Full grid — hidden on mobile, shown on desktop */}
        <div className="footer-grid">

          {/* ── Brand ── */}
          <div className="footer-brand">
            <Link to="/" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: "1.8rem", lineHeight: 1 }}>⚽</span>
              <div>
                <div style={{ fontWeight: 900, fontSize: "1.1rem", color: "var(--text)", letterSpacing: 2, lineHeight: 1.1 }}>GOLAZO</div>
                <div style={{ fontSize: ".52rem", color: "var(--accent)", letterSpacing: 2, textTransform: "uppercase" }}>{brandSubtitle}</div>
              </div>
            </Link>
            <p style={{ color: "var(--muted)", fontSize: "0.82rem", lineHeight: 1.65, margin: "0 0 18px", maxWidth: 220 }}>
              {t("footer.tagline")}
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              {SOCIAL.map(s => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={s.label}
                  className="footer-social-icon"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* ── Scores ── */}
          <div className="footer-col">
            <h4 className="footer-col__title">{t("nav.scores")}</h4>
            <ul className="footer-links">
              <li><Link to="/scores/today">{t("time.today")}</Link></li>
              <li><Link to="/scores/live">{t("nav.live")}</Link></li>
              <li><Link to="/scores/results">{t("nav.results")}</Link></li>
              <li><Link to="/scores/groups">{t("nav.groupStage")}</Link></li>
              <li><Link to="/scores/knockout">{t("nav.knockout")}</Link></li>
            </ul>
          </div>

          {/* ── Leagues ── */}
          <div className="footer-col">
            <h4 className="footer-col__title">{t("nav.leagues", "Leagues")}</h4>
            <ul className="footer-links">
              <li><Link to="/leagues">{t("nav.allLeagues")}</Link></li>
              <li><Link to="/leagues/PL">Premier League</Link></li>
              <li><Link to="/leagues/LAL">La Liga</Link></li>
              <li><Link to="/leagues/BL1">Bundesliga</Link></li>
              <li><Link to="/leagues/UCL">Champions League</Link></li>
            </ul>
          </div>

          {/* ── Mundial ── */}
          <div className="footer-col">
            <h4 className="footer-col__title">{t("nav.mundial")}</h4>
            <ul className="footer-links">
              <li><Link to="/mundial/teams">{t("nav.teams")}</Link></li>
              <li><Link to="/mundial/schedule">{t("nav.schedule")}</Link></li>
              <li><Link to="/mundial/venues">{t("nav.venues")}</Link></li>
              <li><Link to="/mundial/scorers">{t("nav.topScorers")}</Link></li>
              <li><Link to="/news">{t("nav.news")}</Link></li>
            </ul>
          </div>

        </div>

        {/* ── Bottom bar — always visible ── */}
        <div className="footer-bottom">
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.78rem" }}>
            {t("footer.copyright", { year: new Date().getFullYear() })}
          </p>
          <LanguageSwitcher />
        </div>

      </div>
    </footer>
  )
}
