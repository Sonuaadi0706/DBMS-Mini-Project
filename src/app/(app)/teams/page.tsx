import Link from 'next/link';
import { pageUser } from '@/lib/auth/page';
import { listCourses, listTeams } from '@/lib/data/queries';
import { Empty, PageTitle, StatusChip } from '@/components/ui';
import { CreateTeamForm } from '@/components/TeamForms';

export default async function TeamsPage() {
  const user = await pageUser();
  const [teams, courses] = await Promise.all([listTeams(user), listCourses()]);
  const isAdmin = user.roles.includes('admin');
  const canCreate = isAdmin || user.roles.includes('student');
  return (
    <section className="space-y-4">
      <PageTitle title="Teams" subtitle="A student belongs to one team per course." />
      {teams.length === 0 ? <Empty>No teams yet.</Empty> : (
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="p-3">Team</th><th className="p-3">Course</th><th className="p-3">Members</th><th className="p-3">Project</th></tr></thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.team_id} className="border-b last:border-0">
                  <td className="p-3"><Link className="font-medium text-indigo-700 hover:underline" href={`/teams/${t.team_id}`}>{t.team_name}</Link></td>
                  <td className="p-3">{t.course_name}</td><td className="p-3">{t.member_count}</td>
                  <td className="p-3">{t.project_id ? <span className="flex items-center gap-2"><Link className="hover:underline" href={`/proposals/${t.project_id}`}>{t.project_title}</Link><StatusChip status={t.project_status!} /></span> : <span className="text-slate-400">No proposal</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canCreate && <CreateTeamForm courses={courses} isAdmin={isAdmin} />}
    </section>
  );
}
