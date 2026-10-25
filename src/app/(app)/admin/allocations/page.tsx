import Link from 'next/link';
import { pageUser } from '@/lib/auth/page';
import { query } from '@/lib/db/pg';
import { Card, StatusChip } from '@/components/ui';
import { AllocationRow } from '@/components/AllocationRow';

export default async function AllocationsPage() {
  await pageUser();
  const [projects, allocations, guides, reviewers] = await Promise.all([
    query<{ project_id: number; title: string; status: string; team_name: string; course_name: string }>(
      `SELECT p.project_id, p.title, p.status, t.team_name, c.course_name FROM projects p
         JOIN teams t ON t.team_id = p.team_id JOIN courses c ON c.course_id = p.course_id
        WHERE p.status NOT IN ('rejected','archived') ORDER BY c.course_name, t.team_name`),
    query<{ allocation_id: number; project_id: number; user_id: number; name: string; allocation_role: string }>(
      `SELECT ga.allocation_id, ga.project_id, ga.user_id, u.name, ga.allocation_role FROM guide_allocations ga JOIN users u ON u.user_id = ga.user_id`),
    query<{ user_id: number; name: string }>(`SELECT u.user_id, u.name FROM users u JOIN user_roles ur USING (user_id) JOIN roles r USING (role_id) WHERE r.role_name = 'faculty_guide' AND u.status = 'active' ORDER BY u.name`),
    query<{ user_id: number; name: string }>(`SELECT u.user_id, u.name FROM users u JOIN user_roles ur USING (user_id) JOIN roles r USING (role_id) WHERE r.role_name = 'reviewer' AND u.status = 'active' ORDER BY u.name`),
  ]);
  return (
    <section className="space-y-3">
      <p className="text-sm text-slate-600">One guide per project. A guide or reviewer can never be a member of the team they oversee.</p>
      {projects.map((p) => (
        <Card key={p.project_id}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div><Link className="font-medium text-indigo-700 hover:underline" href={`/proposals/${p.project_id}`}>{p.title}</Link><div className="text-xs text-slate-500">Team {p.team_name} · {p.course_name}</div></div>
            <StatusChip status={p.status} />
          </div>
          <AllocationRow projectId={p.project_id} allocations={allocations.filter((a) => a.project_id === p.project_id)} guides={guides} reviewers={reviewers} />
        </Card>
      ))}
    </section>
  );
}
