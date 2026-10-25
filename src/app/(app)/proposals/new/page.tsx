import Link from 'next/link';
import { redirect } from 'next/navigation';
import { pageUser } from '@/lib/auth/page';
import { query } from '@/lib/db/pg';
import { Empty, PageTitle } from '@/components/ui';
import { ProposalForm } from '@/components/ProposalForm';

export default async function NewProposalPage() {
  const user = await pageUser();
  if (!user.roles.includes('student')) redirect('/proposals');
  // Teams that do not yet have an active project can start a proposal.
  const teams = await query<{ team_id: number; label: string }>(
    `SELECT t.team_id, t.team_name || ' (' || c.course_name || ')' AS label
       FROM team_members tm JOIN teams t ON t.team_id = tm.team_id JOIN courses c ON c.course_id = t.course_id
      WHERE tm.user_id = $1
        AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.team_id = t.team_id AND p.status NOT IN ('rejected','archived'))`, [user.userId]);
  return (
    <section>
      <PageTitle title="New proposal" subtitle="Describe the project. You can save a draft and finish it later." />
      {teams.length === 0 ? (
        <Empty>Your team already has an active proposal, or you are not in a team yet. <Link href="/teams" className="text-indigo-700 underline">Go to Teams</Link>.</Empty>
      ) : <ProposalForm teams={teams} />}
    </section>
  );
}
