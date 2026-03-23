import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import Login from './pages/Login';
import LandingPage from './pages/LandingPage';
import AdminCommandCenter from './pages/AdminCommandCenter';
import MemberDashboard from './pages/MemberDashboard';
import { useStore } from './store/useStore';
import Finances from './pages/Finances';
import AdminSetup from './pages/AdminSetup';
import MemberEnrollment from './pages/MemberEnrollment';
import InviteHub from './pages/InviteHub';
import PayoutRules from './pages/PayoutRules';
import Standings from './pages/Standings';
import Deposit from './pages/Deposit';
import Profile from './pages/Profile';
import Terms from './pages/Terms';
import PrivacyPolicy from './pages/PrivacyPolicy';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import { NotificationProvider } from './components/NotificationProvider';

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

  // Same auth detection pattern used across all pages:
  // login persists activeLeagueId + memberPhone to localStorage
  const leagueId = localStorage.getItem('activeLeagueId');
  const phone = localStorage.getItem('memberPhone');
  const isAuthenticated = !!(leagueId && phone && role);

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
  return (
    <>
      <Routes>
        {/* Public routes — no AppLayout shell */}
        <Route path="/" element={<RootRoute />} />
        <Route path="/login" element={<Login />} />
        <Route path="/setup" element={<AdminSetup />} />
        <Route path="/invite" element={<InviteHub />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/hq" element={<SuperAdminDashboard />} />

        {/* Authenticated routes — inside the AppLayout + NotificationProvider shell */}
        <Route element={<AppLayoutWrapper />}>
          <Route path="/dashboard" element={<DashboardRenderer />} />
          <Route path="/finances" element={<Finances />} />
          <Route path="/access" element={<MemberEnrollment />} />
          <Route path="/rules" element={<PayoutRules />} />
          <Route path="/standings" element={<Standings />} />
          <Route path="/deposit" element={<Deposit />} />
          <Route path="/profile" element={<Profile />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
