import { Routes, Route, Navigate, useLocation } from "react-router-dom"
import Navbar from "./components/Navbar"
import Footer from "./components/Footer"

import HomePage        from "./pages/HomePage"
import ScoresPage      from "./pages/ScoresPage"
import TodayPage       from "./pages/scores/TodayPage"
import LivePage        from "./pages/scores/LivePage"
import ResultsPage     from "./pages/scores/ResultsPage"
import FixturesPage    from "./pages/scores/FixturesPage"
import GroupStagePage  from "./pages/scores/GroupStagePage"
import KnockoutPage    from "./pages/scores/KnockoutPage"
import GroupsPage      from "./pages/GroupsPage"
import GroupDetailPage from "./pages/GroupDetailPage"
import AllGroupsPage   from "./pages/AllGroupsPage"
import MundialPage     from "./pages/MundialPage"
import TeamsPage       from "./pages/mundial/TeamsPage"
import SchedulePage    from "./pages/mundial/SchedulePage"
import VenuesPage      from "./pages/mundial/VenuesPage"
import ScorersPage     from "./pages/mundial/ScorersPage"
import AllLeaguesPage  from "./pages/AllLeaguesPage"
import LeagueDetailPage from "./pages/LeagueDetailPage"
import NewsPage        from "./pages/NewsPage"
import NewsShowPage    from "./pages/NewsShowPage"
import MatchShowPage   from "./pages/MatchShowPage"
import TeamShowPage    from "./pages/TeamShowPage"

export default function App() {
  const location = useLocation()
  return (
    <div className="site-wrap">
      <Navbar />

      <main key={location.pathname} className="main-content page-transition">
        <Routes>
          <Route path="/" element={<HomePage />} />

          <Route path="/scores" element={<ScoresPage />}>
            <Route index element={<Navigate to="/scores/today" replace />} />
            <Route path="today"    element={<TodayPage />} />
            <Route path="live"     element={<LivePage />} />
            <Route path="results"  element={<ResultsPage />} />
            <Route path="fixtures" element={<FixturesPage />} />
            <Route path="groups"   element={<GroupStagePage />} />
            <Route path="knockout" element={<KnockoutPage />} />
          </Route>

          <Route path="/groups" element={<GroupsPage />}>
            <Route index element={<AllGroupsPage />} />
            <Route path=":group" element={<GroupDetailPage />} />
          </Route>

          <Route path="/mundial" element={<MundialPage />}>
            <Route index element={<Navigate to="/mundial/teams" replace />} />
            <Route path="teams"    element={<TeamsPage />} />
            <Route path="schedule" element={<SchedulePage />} />
            <Route path="venues"   element={<VenuesPage />} />
            <Route path="scorers"  element={<ScorersPage />} />
          </Route>

          <Route path="/teams/:id"    element={<TeamShowPage />} />
          <Route path="/leagues"      element={<AllLeaguesPage />} />
          <Route path="/leagues/:code" element={<LeagueDetailPage />} />
          <Route path="/matches/:id"  element={<MatchShowPage />} />
          <Route path="/news"         element={<NewsPage />} />
          <Route path="/news/:id"     element={<NewsShowPage />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <Footer />
    </div>
  )
}
