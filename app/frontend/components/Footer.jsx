import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import LanguageSwitcher from "./LanguageSwitcher"
import { useAppFocus } from "../hooks/useAppFocus"
import { NAV_LEAGUES } from "./ClubCompetitionChips"


export default function Footer() {
  const { t } = useTranslation()
  const { clubs_primary: clubsPrimary } = useAppFocus()
  const brandSubtitle = clubsPrimary ? t("hero.clubBadge") : t("nav.mundialShort")

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
              {t(clubsPrimary ? "footer.taglineClubs" : "footer.tagline")}
            </p>
          </div>

          {/* ── Scores ── */}
          <div className="footer-col">
            <h4 className="footer-col__title">{t("nav.scores")}</h4>
            <ul className="footer-links">
              <li><Link to="/scores/today">{t("time.today")}</Link></li>
              <li><Link to="/scores/results">{t("nav.results")}</Link></li>
              {!clubsPrimary && (
                <>
                  <li><Link to="/scores/groups">{t("nav.groupStage")}</Link></li>
                  <li><Link to="/scores/knockout">{t("nav.knockout")}</Link></li>
                </>
              )}
            </ul>
          </div>

          {/* ── Leagues ── */}
          <div className="footer-col">
            <h4 className="footer-col__title">{t("nav.leagues")}</h4>
            <ul className="footer-links">
              <li><Link to="/leagues">{t("nav.allLeagues")}</Link></li>
              <li><Link to="/compare/teams">{t("teamComparison.title")}</Link></li>
              {clubsPrimary && (
                <li><Link to="/world-cup-2026">{t("nav.mundial")}</Link></li>
              )}
              {NAV_LEAGUES.map(({ key, path }) => (
                <li key={path}><Link to={path}>{t(key)}</Link></li>
              ))}
            </ul>
          </div>

          {/* ── Mundial ── */}
          {!clubsPrimary && (
          <div className="footer-col">
            <h4 className="footer-col__title">{t("nav.mundial")}</h4>
            <ul className="footer-links">
              <li><Link to="/mundial/teams">{t("nav.teams")}</Link></li>
              <li><Link to="/mundial/schedule">{t("nav.schedule")}</Link></li>
              <li><Link to="/mundial/venues">{t("nav.venues")}</Link></li>
              <li><Link to="/mundial/scorers">{t("nav.topScorers")}</Link></li>
              <li><Link to="/predictor">{t("nav.predictor")}</Link></li>
              <li><Link to="/leaderboard">{t("nav.leaderboard")}</Link></li>
              <li><Link to="/news">{t("nav.news")}</Link></li>
            </ul>
          </div>
          )}

          {clubsPrimary && (
          <div className="footer-col">
            <h4 className="footer-col__title">{t("nav.news")}</h4>
            <ul className="footer-links">
              <li><Link to="/news">{t("news.allNews")}</Link></li>
              <li><Link to="/news?tab=foryou">{t("news.forYou")}</Link></li>
            </ul>
          </div>
          )}

        </div>

        {/* ── Bottom bar — always visible ── */}
        <div className="footer-bottom">
          <p style={{ margin: 0, color: "var(--muted)", fontSize: "0.78rem" }}>
            {t(clubsPrimary ? "footer.copyrightClubs" : "footer.copyright", { year: new Date().getFullYear() })}
          </p>
          <LanguageSwitcher />
        </div>

      </div>
    </footer>
  )
}
