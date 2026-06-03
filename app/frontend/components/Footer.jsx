import { Link } from "react-router-dom"

const GROUPS = Array.from({ length: 12 }, (_, i) => String.fromCharCode(65 + i))

export default function Footer() {
  return (
    <footer className="footer-section">
      <div className="container">
        <div className="row">

          <div className="col-lg-3 col-md-6">
            <div className="widget mb-3">
              <h3>Scores</h3>
              <ul className="list-unstyled links">
                <li><Link to="/scores/live">Live Matches</Link></li>
                <li><Link to="/scores/results">Results</Link></li>
                <li><Link to="/scores/fixtures">Fixtures</Link></li>
                <li><Link to="/scores/groups">Group Stage</Link></li>
                <li><Link to="/scores/knockout">Knockout Rounds</Link></li>
              </ul>
            </div>
          </div>

          <div className="col-lg-3 col-md-6">
            <div className="widget mb-3">
              <h3>Groups</h3>
              <ul className="list-unstyled links">
                {GROUPS.map(g => (
                  <li key={g}><Link to={`/groups/${g}`}>Group {g}</Link></li>
                ))}
              </ul>
            </div>
          </div>

          <div className="col-lg-3 col-md-6">
            <div className="widget mb-3">
              <h3>Mundial 2026</h3>
              <ul className="list-unstyled links">
                <li><Link to="/mundial/teams">Teams</Link></li>
                <li><Link to="/mundial/schedule">Schedule</Link></li>
                <li><Link to="/mundial/venues">Venues</Link></li>
                <li><Link to="/mundial/scorers">Top Scorers</Link></li>
              </ul>
            </div>
          </div>

          <div className="col-lg-3 col-md-6">
            <div className="widget mb-3">
              <h3>Follow</h3>
              <ul className="list-unstyled links">
                <li><a href="https://twitter.com" target="_blank" rel="noreferrer">Twitter / X</a></li>
                <li><a href="https://instagram.com" target="_blank" rel="noreferrer">Instagram</a></li>
                <li><a href="https://youtube.com" target="_blank" rel="noreferrer">YouTube</a></li>
                <li><a href="https://facebook.com" target="_blank" rel="noreferrer">Facebook</a></li>
              </ul>
            </div>
          </div>

        </div>

        <div className="row text-center">
          <div className="col-md-12">
            <div className="pt-5">
              <p>
                Copyright &copy; {new Date().getFullYear()} Golazo — Mundial 2026 Live Scores.
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
