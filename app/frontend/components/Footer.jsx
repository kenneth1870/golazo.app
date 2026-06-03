export default function Footer() {
  return (
    <footer className="footer-section">
      <div className="container">
        <div className="row">
          <div className="col-lg-3">
            <div className="widget mb-3">
              <h3>Scores</h3>
              <ul className="list-unstyled links">
                <li><a href="#">Live Matches</a></li>
                <li><a href="#">Results</a></li>
                <li><a href="#">Fixtures</a></li>
                <li><a href="#">Group Stage</a></li>
                <li><a href="#">Knockout Rounds</a></li>
              </ul>
            </div>
          </div>
          <div className="col-lg-3">
            <div className="widget mb-3">
              <h3>Groups</h3>
              <ul className="list-unstyled links">
                {["A","B","C","D","E","F"].map(g => (
                  <li key={g}><a href="#">Group {g}</a></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="col-lg-3">
            <div className="widget mb-3">
              <h3>Mundial 2026</h3>
              <ul className="list-unstyled links">
                <li><a href="#">Teams</a></li>
                <li><a href="#">Schedule</a></li>
                <li><a href="#">Venues</a></li>
                <li><a href="#">Top Scorers</a></li>
              </ul>
            </div>
          </div>
          <div className="col-lg-3">
            <div className="widget mb-3">
              <h3>Follow</h3>
              <ul className="list-unstyled links">
                <li><a href="#">Twitter / X</a></li>
                <li><a href="#">Instagram</a></li>
                <li><a href="#">YouTube</a></li>
                <li><a href="#">Facebook</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="row text-center">
          <div className="col-md-12">
            <div className="pt-5">
              <p>
                Copyright &copy; {new Date().getFullYear()} Golazo — Mundial 2026 Live Scores.
                Design based on <a href="https://colorlib.com" target="_blank" rel="noreferrer">Colorlib</a> Soccer template.
              </p>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
