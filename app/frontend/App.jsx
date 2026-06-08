import { lazy, Suspense } from "react"
import { Routes, Route, Navigate, useLocation } from "react-router-dom"
import { useLocale } from "./hooks/useLocale"
import Navbar from "./components/Navbar"
import Footer from "./components/Footer"
import BottomNav from "./components/BottomNav"
import InstallPrompt from "./components/InstallPrompt"
import ScrollToTop from "./components/ScrollToTop"
import ErrorBoundary from "./components/ErrorBoundary"

// Critical path — loaded eagerly (always needed on first paint)
import HomePage   from "./pages/HomePage"
import ScoresPage from "./pages/ScoresPage"
import TodayPage  from "./pages/scores/TodayPage"

// Secondary — lazy-loaded so they don't bloat the initial bundle
const LivePage        = lazy(() => import("./pages/scores/LivePage"))
const ResultsPage     = lazy(() => import("./pages/scores/ResultsPage"))
const FixturesPage    = lazy(() => import("./pages/scores/FixturesPage"))
const GroupStagePage  = lazy(() => import("./pages/scores/GroupStagePage"))
const KnockoutPage    = lazy(() => import("./pages/scores/KnockoutPage"))
const GroupsPage      = lazy(() => import("./pages/GroupsPage"))
const GroupDetailPage = lazy(() => import("./pages/GroupDetailPage"))
const AllGroupsPage   = lazy(() => import("./pages/AllGroupsPage"))
const MundialPage     = lazy(() => import("./pages/MundialPage"))
const TeamsPage       = lazy(() => import("./pages/mundial/TeamsPage"))
const SchedulePage    = lazy(() => import("./pages/mundial/SchedulePage"))
const VenuesPage      = lazy(() => import("./pages/mundial/VenuesPage"))
const ScorersPage     = lazy(() => import("./pages/mundial/ScorersPage"))
const AllLeaguesPage  = lazy(() => import("./pages/AllLeaguesPage"))
const LeagueDetailPage = lazy(() => import("./pages/LeagueDetailPage"))
const NewsPage        = lazy(() => import("./pages/NewsPage"))
const NewsShowPage    = lazy(() => import("./pages/NewsShowPage"))
const MatchShowPage   = lazy(() => import("./pages/MatchShowPage"))
const TeamShowPage          = lazy(() => import("./pages/TeamShowPage"))
const BracketPredictorPage  = lazy(() => import("./pages/BracketPredictorPage"))
const LeaderboardPage       = lazy(() => import("./pages/LeaderboardPage"))
const PlayerPage            = lazy(() => import("./pages/PlayerPage"))
const ComparePage           = lazy(() => import("./pages/ComparePage"))

function PageLoader() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 200 }}>
      <div className="spinner" />
    </div>
  )
}

export default function App() {
  const location = useLocation()
  useLocale() // auto-detect language from IP / device on every session
  return (
    <div className="site-wrap">
      <ScrollToTop />
      <Navbar />

      <main key={location.pathname} className="main-content page-transition">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<HomePage />} />

              <Route path="/scores" element={<ScoresPage />}>
                <Route index element={<Navigate to="/scores/today" replace />} />
                <Route path="today"    element={<TodayPage />} />
                <Route path="fixtures" element={<FixturesPage />} />
                <Route path="live"     element={<Navigate to="/scores/today" replace />} />
                <Route path="results"  element={<ResultsPage />} />
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

              <Route path="/teams/:id"     element={<TeamShowPage />} />
              <Route path="/leagues"       element={<AllLeaguesPage />} />
              <Route path="/leagues/:code" element={<LeagueDetailPage />} />
              <Route path="/matches/:id"   element={<MatchShowPage />} />
              <Route path="/predictor"     element={<BracketPredictorPage />} />
              <Route path="/leaderboard"   element={<LeaderboardPage />} />
              <Route path="/compare"       element={<ComparePage />} />
              <Route path="/players/:id"   element={<PlayerPage />} />
              <Route path="/news"          element={<NewsPage />} />
              <Route path="/news/:id"      element={<NewsShowPage />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>

      <Footer />
      <BottomNav />
      <InstallPrompt />
    </div>
  )
}
