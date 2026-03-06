import { Routes, Route } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import Login from './pages/Login';
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

const DashboardRenderer = () => {
  const role = useStore(state => state.role);
  return role === 'admin' ? <AdminCommandCenter /> : <MemberDashboard />;
};

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/setup" element={<AdminSetup />} />
      <Route path="/invite" element={<InviteHub />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardRenderer />} />
        <Route path="/finances" element={<Finances />} />
        <Route path="/access" element={<MemberEnrollment />} />
        <Route path="/rules" element={<PayoutRules />} />
        <Route path="/standings" element={<Standings />} />
        <Route path="/deposit" element={<Deposit />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/terms" element={<Terms />} />
      </Route>
    </Routes>
  );
}

export default App;
