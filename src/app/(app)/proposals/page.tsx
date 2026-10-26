import Link from 'next/link';
import { pageUser } from '@/lib/auth/page';
import { listProjects } from '@/lib/data/queries';
import { ButtonLink, Empty, PageTitle, StatusChip, fmt, label } from '@/components/ui';

const STATUSES = ['draft', 'submitted', 'revision_requested', 'approved', 'in_progress', 'rejected'];

export default async function ProposalsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const user = await pageUser();
  const { status } = await searchParams;
  const active = STATUSES.includes(status ?? '') ? status : undefined;
  const rows = await listProjects(user, active);
  const isStudent = user.roles.includes('student');
  return (
    <section>
      <PageTitle title="Proposals" subtitle="Project proposals and their review status."
        actions={isStudent ? <ButtonLink href="/proposals/new" primary>New proposal</ButtonLink> : undefined} />
      <div className="mb-3 flex flex-wrap gap-2 text-sm">
        <Link href="/proposals" className={`rounded-full border px-3 py-1 ${!active ? 'bg-indigo-600 text-onbrand' : 'bg-white'}`}>All</Link>
        {STATUSES.map((s) => (
          <Link key={s} href={`/proposals?status=${s}`} className={`rounded-full border px-3 py-1 ${active === s ? 'bg-indigo-600 text-onbrand' : 'bg-white'}`}>{label(s)}</Link>
        ))}
      </div>
      {rows.length === 0 ? <Empty>No proposals match.</Empty> : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
              <tr><th className="p-3">Title</th><th className="p-3">Team</th><th className="p-3">Course</th><th className="p-3">Guide</th><th className="p-3">Submitted</th><th className="p-3">Status</th></tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.project_id} className="border-b last:border-0">
                  <td className="p-3"><Link className="font-medium text-indigo-700 hover:underline" href={`/proposals/${p.project_id}`}>{p.title}</Link></td>
                  <td className="p-3">{p.team_name}</td><td className="p-3">{p.course_name}</td>
                  <td className="p-3">{p.guide_name ?? <span className="text-slate-400">Not allocated</span>}</td>
                  <td className="p-3">{fmt(p.submitted_at)}</td><td className="p-3"><StatusChip status={p.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
