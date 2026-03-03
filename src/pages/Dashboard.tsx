import { useStore } from '../store/useStore';
import AdminCommandCenter from './AdminCommandCenter';
import MemberDashboard from './MemberDashboard';

export default function Dashboard() {
    const role = useStore((state) => state.role);

    if (role === 'admin') {
        return <AdminCommandCenter />;
    }

    return <MemberDashboard />;
}
