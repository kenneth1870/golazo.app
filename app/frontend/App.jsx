import { lazy, Suspense } from "react"
import { Routes, Route, Navigate, useLocation } from "react-router-dom"
import { useLocale } from "./hooks/useLocale"
import { useAnalytics } from "./hooks/useAnalytics"
import Navbar from "./components/Navbar"
import Footer from "./components/Footer"
import BottomNav from "./components/BottomNav"
import InstallPrompt from "./components/InstallPrompt"
import ScrollToTop from "./components/ScrollToTop"
import ErrorBoundary from "./components/ErrorBoundary"
import OnboardingModal, { useOnboarding } from "./components/OnboardingModal"
import PushPrompt from "./components/PushPrompt"
import IosInstallGuide from "./components/IosInstallGuide"
import ConsentBanner from "./components/ConsentBanner"
import RequireAdmin from "./components/RequireAdmin"
import LoginPage from "./pages/LoginPage"
import { useFavorites } from "./hooks/useFavorites"

// Critical path — loaded eagerly (always needed on first paint)
import HomePage   from "./pages/HomePage"
import ScoresPage from "./pages/ScoresPage"
import TodayPage  from "./pages/scores/TodayPage"

// Secondary — lazy-loaded so they don't bloat the initial bundle
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
const VenueShowPage   = lazy(() => import("./pages/mundial/VenueShowPage"))
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
const TeamComparisonPage    = lazy(() => import("./pages/TeamComparisonPage"))
const AdminLayout           = lazy(() => import("./pages/admin/AdminLayout"))
const AdminDashboardPage    = lazy(() => import("./pages/admin/AdminDashboardPage"))
const AdminMatchesPage      = lazy(() => import("./pages/admin/AdminMatchesPage"))
const AdminTeamsPage        = lazy(() => import("./pages/admin/AdminTeamsPage"))
const AdminStandingsPage    = lazy(() => import("./pages/admin/AdminStandingsPage"))
const AdminPushPage         = lazy(() => import("./pages/admin/AdminPushPage"))
const AdminDevicesPage      = lazy(() => import("./pages/admin/AdminDevicesPage"))
const AdminUsersPage        = lazy(() => import("./pages/admin/AdminUsersPage"))
const AdminNewsPage         = lazy(() => import("./pages/admin/AdminNewsPage"))

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
  useAnalytics() // fire-and-forget usage heartbeat for the admin device panel
  const { show: showOnboarding, dismiss: dismissOnboarding } = useOnboarding()
  const { favoriteTeams } = useFavorites()
  const favTeamName = favoriteTeams[0]?.name ?? null

  // Admin + login routes render outside the public layout (no Navbar/Footer/BottomNav)
  const isAdminOrAuth = location.pathname.startsWith("/admin") || location.pathname === "/login"
  if (isAdminOrAuth) {
    return (
      <ErrorBoundary>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
              <Route index              element={<AdminDashboardPage />} />
              <Route path="matches"     element={<AdminMatchesPage />} />
              <Route path="teams"       element={<AdminTeamsPage />} />
              <Route path="standings"   element={<AdminStandingsPage />} />
              <Route path="push"        element={<AdminPushPage />} />
              <Route path="devices"     element={<AdminDevicesPage />} />
              <Route path="users"       element={<AdminUsersPage />} />
              <Route path="news"        element={<AdminNewsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    )
  }

  return (
    <div className="site-wrap">
      <ScrollToTop />
      <Navbar />
      {showOnboarding && <OnboardingModal onDismiss={dismissOnboarding} />}
      <PushPrompt favoriteTeamName={favTeamName} />
      <IosInstallGuide />

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
                <Route path="venues">
                  <Route index element={<VenuesPage />} />
                  <Route path=":slug" element={<VenueShowPage />} />
                </Route>
                <Route path="scorers"  element={<ScorersPage />} />
              </Route>

              <Route path="/teams/:id"     element={<TeamShowPage />} />
              <Route path="/leagues"       element={<AllLeaguesPage />} />
              <Route path="/leagues/:code" element={<LeagueDetailPage />} />
              <Route path="/matches/:id"   element={<MatchShowPage />} />
              <Route path="/predictor"     element={<BracketPredictorPage />} />
              <Route path="/leaderboard"   element={<LeaderboardPage />} />
              <Route path="/compare"       element={<ComparePage />} />
              <Route path="/compare/teams" element={<TeamComparisonPage />} />
              <Route path="/players/:id"   element={<PlayerPage />} />
              <Route path="/news"          element={<NewsPage />} />
              <Route path="/news/:id"      element={<NewsShowPage />} />

              {/* /world-cup-2026/* — SEO-friendly aliases → canonical /mundial/* routes */}
              <Route path="/world-cup-2026"           element={<Navigate to="/mundial/teams"    replace />} />
              <Route path="/world-cup-2026/teams"     element={<Navigate to="/mundial/teams"    replace />} />
              <Route path="/world-cup-2026/schedule"  element={<Navigate to="/mundial/schedule" replace />} />
              <Route path="/world-cup-2026/venues"    element={<Navigate to="/mundial/venues"   replace />} />
              <Route path="/world-cup-2026/scorers"   element={<Navigate to="/mundial/scorers"  replace />} />
              <Route path="/world-cup-2026/groups"    element={<Navigate to="/scores/groups"    replace />} />
              <Route path="/world-cup-2026/bracket"   element={<Navigate to="/scores/knockout"  replace />} />
              <Route path="/world-cup-2026/results"   element={<Navigate to="/scores/results"   replace />} />
              <Route path="/world-cup-2026/fixtures"  element={<Navigate to="/scores/fixtures"  replace />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>

      <Footer />
      <ConsentBanner />
      <BottomNav />
      <InstallPrompt />
    </div>
  )
}
