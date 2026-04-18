import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import { useStore } from './store/useStore';
import ErrorBoundary from './components/ErrorBoundary';
import { NotificationProvider } from './components/NotificationProvider';

const Login = lazy(() => import('./pages/Login'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const AdminCommandCenter = lazy(() => import('./pages/AdminCommandCenter'));
const MemberDashboard = lazy(() => import('./pages/MemberDashboard'));
const Finances = lazy(() => import('./pages/Finances'));
const AdminSetup = lazy(() => import('./pages/AdminSetup'));
const MemberEnrollment = lazy(() => import('./pages/MemberEnrollment'));
const InviteHub = lazy(() => import('./pages/InviteHub'));
const PayoutRules = lazy(() => import('./pages/PayoutRules'));
const Standings = lazy(() => import('./pages/Standings'));
const Deposit = lazy(() => import('./pages/Deposit'));
const Profile = lazy(() => import('./pages/Profile'));
const Terms = lazy(() => import('./pages/Terms'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const FAQ = lazy(() => import('./pages/FAQ'));
const SuperAdminDashboard = lazy(() => import('./pages/SuperAdminDashboard'));
const WinSharePage = lazy(() => import('./pages/WinSharePage'));
const Error808 = lazy(() => import('./pages/Error808'));

const RouteLoader = () => (
  <div className="min-h-screen w-full flex items-center justify-center bg-[#0b1014] text-[#10B981] text-sm font-bold tracking-widest uppercase">
    Loading War Room...
  </div>
);

// Renders the correct dashboard based on role — used inside the AppLayout
const DashboardRenderer = () => {
  const role = useStore(state => state.role);
  return role === 'admin' ? <AdminCommandCenter /> : <MemberDashboard />;
};

// Smart root route:
//   - Unauthenticated visitor  → LandingPage (the public storefront)
//   - Authenticated member     → /dashboard → MemberDashboard (inside AppLayout)
//   - Authenticated admin      → /dashboard → AdminCommandCenter (inside AppLayout)
const RootRoute = () => {
  const role = useStore(state => state.role);

  // Auth detection pattern:
  // Core authentication only strictly mandates leagueId and role.
  // Member logins also set phone, but Admin logins just require role.
  const leagueId = localStorage.getItem('activeLeagueId');
  const isAuthenticated = !!(leagueId && role);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <LandingPage />;
};

const AppLayoutWrapper = () => (
  <NotificationProvider>
    <AppLayout />
  </NotificationProvider>
);

function App() {
  const role = useStore(state => state.role);
  const hasActiveLeague = !!localStorage.getItem('activeLeagueId');

  useEffect(() => {
    const leagueId = localStorage.getItem('activeLeagueId');
    const userId = localStorage.getItem('activeUserId');
    if (!leagueId || !userId) return;

    import('./hooks/useFCMToken')
      .then(({ registerFCMToken }) => registerFCMToken())
      .catch((err) => console.error('[FCM] Deferred bootstrap failed:', err));
  }, []);

  return (
    <>
      <ErrorBoundary fallbackMessage="FantasyChama encountered an unexpected error. Your data is safe — please retry.">
        <Suspense fallback={<RouteLoader />}>
          <Routes>
            {/* Public routes — no AppLayout shell */}
            <Route path="/" element={<RootRoute />} />
            <Route path="/login" element={<Login />} />
            <Route path="/setup" element={(role || hasActiveLeague) ? <Navigate to="/dashboard" replace /> : <AdminSetup />} />
            <Route path="/invite" element={<InviteHub />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/hq" element={<SuperAdminDashboard />} />
            <Route path="/win" element={<WinSharePage />} />
            <Route path="*" element={<Error808 />} />

            {/* Authenticated routes — inside the AppLayout + NotificationProvider shell */}
            <Route element={<AppLayoutWrapper />}>
              <Route path="/dashboard" element={<DashboardRenderer />} />
              <Route path="/command-center" element={role === 'admin' ? <AdminCommandCenter /> : <Navigate to="/dashboard" replace />} />
              <Route path="/finances" element={<Finances />} />
              <Route path="/access" element={<MemberEnrollment />} />
              <Route path="/rules" element={<PayoutRules />} />
              <Route path="/standings" element={<Standings />} />
              <Route path="/deposit" element={<Deposit />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </>
  );
}

export default App;
