import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import LanguageSwitcher from "./LanguageSwitcher"

const GROUPS = Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i))

export default function Footer() {
  const { t } = useTranslation()
  return (
    <footer className="footer-section">
      <div className="container">
        <div className="row">

          <div className="col-lg-3 col-md-6">
            <div className="widget mb-3">
              <h3>{t("nav.scores")}</h3>
              <ul className="list-unstyled links">
                <li><Link to="/scores/live">{t("nav.live")}</Link></li>
                <li><Link to="/scores/results">{t("nav.results")}</Link></li>
                <li><Link to="/scores/fixtures">{t("nav.fixtures")}</Link></li>
                <li><Link to="/scores/groups">{t("nav.groupStage")}</Link></li>
                <li><Link to="/scores/knockout">{t("nav.knockout")}</Link></li>
              </ul>
            </div>
          </div>

          <div className="col-lg-3 col-md-6">
            <div className="widget mb-3">
              <h3>{t("nav.groups")}</h3>
              <ul className="list-unstyled links">
                {GROUPS.map(g => (
                  <li key={g}><Link to={`/groups/${g}`}>{t("nav.group", { letter: g })}</Link></li>
                ))}
              </ul>
            </div>
          </div>

          <div className="col-lg-3 col-md-6">
            <div className="widget mb-3">
              <h3>{t("nav.mundial")}</h3>
              <ul className="list-unstyled links">
                <li><Link to="/mundial/teams">{t("nav.teams")}</Link></li>
                <li><Link to="/mundial/schedule">{t("nav.schedule")}</Link></li>
                <li><Link to="/mundial/venues">{t("nav.venues")}</Link></li>
                <li><Link to="/mundial/scorers">{t("nav.topScorers")}</Link></li>
              </ul>
            </div>
          </div>

          <div className="col-lg-3 col-md-6">
            <div className="widget mb-3">
              <h3>{t("footer.follow")}</h3>
              <ul className="list-unstyled links">
                <li><a href="https://twitter.com" target="_blank" rel="noreferrer">Twitter / X</a></li>
                <li><a href="https://instagram.com" target="_blank" rel="noreferrer">Instagram</a></li>
                <li><a href="https://youtube.com" target="_blank" rel="noreferrer">YouTube</a></li>
                <li><a href="https://facebook.com" target="_blank" rel="noreferrer">Facebook</a></li>
              </ul>
            </div>
          </div>

        </div>

        <div className="row">
          <div className="col-md-8">
            <div className="pt-4">
              <p>{t("footer.copyright", { year: new Date().getFullYear() })}</p>
            </div>
          </div>
          <div className="col-md-4 d-flex align-items-center justify-content-md-end pt-4">
            <LanguageSwitcher />
          </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
