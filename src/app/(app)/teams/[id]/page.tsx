import Link from 'next/link';
import { notFound } from 'next/navigation';
import { pageId, pageUser } from '@/lib/auth/page';
import { requireTeamAccess } from '@/lib/auth/team-access';
import { getTeamMembers, listTeams } from '@/lib/data/queries';
import { PageTitle, StatusChip } from '@/components/ui';
import { MembersTable } from '@/components/TeamForms';

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await pageUser();
  const teamId = pageId((await params).id);
  const access = await requireTeamAccess(user, teamId).catch(() => null);
  if (!access) notFound();
  const [members, teams] = await Promise.all([getTeamMembers(teamId), listTeams(user)]);
  const team = teams.find((t) => t.team_id === teamId);
  return (
    <section className="space-y-4">
      <PageTitle title={`Team ${access.teamName}`} subtitle={team?.course_name}
        actions={team?.project_id ? <><StatusChip status={team.project_status!} /><Link className="text-sm text-indigo-700 underline" href={`/proposals/${team.project_id}`}>{team.project_title}</Link></> : undefined} />
      <MembersTable teamId={teamId} courseId={access.courseId} members={members}
        canManage={access.isAdmin || access.isLeader} isAdmin={access.isAdmin} />
      <Link href="/teams" className="text-sm text-slate-500 hover:text-slate-900">← All teams</Link>
    </section>
  );
}
