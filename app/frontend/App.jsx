import { Routes, Route, Navigate } from "react-router-dom"
import Navbar from "./components/Navbar"
import Footer from "./components/Footer"

import HomePage       from "./pages/HomePage"
import ScoresPage     from "./pages/ScoresPage"
import LivePage       from "./pages/scores/LivePage"
import ResultsPage    from "./pages/scores/ResultsPage"
import FixturesPage   from "./pages/scores/FixturesPage"
import GroupStagePage from "./pages/scores/GroupStagePage"
import KnockoutPage   from "./pages/scores/KnockoutPage"
import GroupsPage     from "./pages/GroupsPage"
import GroupDetailPage from "./pages/GroupDetailPage"
import MundialPage    from "./pages/MundialPage"
import TeamsPage      from "./pages/mundial/TeamsPage"
import SchedulePage   from "./pages/mundial/SchedulePage"
import VenuesPage     from "./pages/mundial/VenuesPage"
import ScorersPage    from "./pages/mundial/ScorersPage"
import AllLeaguesPage from "./pages/AllLeaguesPage"
import NewsPage       from "./pages/NewsPage"

export default function App() {
  return (
    <div className="site-wrap">
      <Navbar />

      <main className="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />

          <Route path="/scores" element={<ScoresPage />}>
            <Route index element={<Navigate to="/scores/live" replace />} />
            <Route path="live"     element={<LivePage />} />
            <Route path="results"  element={<ResultsPage />} />
            <Route path="fixtures" element={<FixturesPage />} />
            <Route path="groups"   element={<GroupStagePage />} />
            <Route path="knockout" element={<KnockoutPage />} />
          </Route>

          <Route path="/groups" element={<GroupsPage />}>
            <Route index element={<Navigate to="/groups/A" replace />} />
            <Route path=":group" element={<GroupDetailPage />} />
          </Route>

          <Route path="/mundial" element={<MundialPage />}>
            <Route index element={<Navigate to="/mundial/teams" replace />} />
            <Route path="teams"    element={<TeamsPage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="venues"   element={<VenuesPage />} />
            <Route path="scorers"  element={<ScorersPage />} />
          </Route>

          <Route path="/leagues" element={<AllLeaguesPage />} />
          <Route path="/news"    element={<NewsPage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <Footer />
    </div>
  )
}
