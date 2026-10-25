import { pageUser } from '@/lib/auth/page';
import { AdminDashboard, GuideDashboard, ReviewerDashboard, StudentDashboard } from '@/components/Dashboards';

// One URL, four dashboards: the active role (see the role switcher) decides which one is shown.
export default async function DashboardPage() {
  const user = await pageUser();
  switch (user.activeRole) {
    case 'admin': return <AdminDashboard user={user} />;
    case 'faculty_guide': return <GuideDashboard user={user} />;
    case 'reviewer': return <ReviewerDashboard user={user} />;
    default: return <StudentDashboard user={user} />;
  }
}
