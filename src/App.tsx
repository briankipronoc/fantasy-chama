import { Routes, Route } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/AdminCommandCenter';
import Finances from './pages/Finances';
import AdminSetup from './pages/AdminSetup';
import MemberEnrollment from './pages/MemberEnrollment';
import InviteHub from './pages/InviteHub';
import PayoutRules from './pages/PayoutRules';
import Standings from './pages/Standings';
import Deposit from './pages/Deposit';
import Profile from './pages/Profile';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/setup" element={<AdminSetup />} />
      <Route path="/invite" element={<InviteHub />} />
      <Route element={<AppLayout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/finances" element={<Finances />} />
        <Route path="/access" element={<MemberEnrollment />} />
        <Route path="/rules" element={<PayoutRules />} />
        <Route path="/standings" element={<Standings />} />
        <Route path="/deposit" element={<Deposit />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
    </Routes>
  );
}

export default App;
