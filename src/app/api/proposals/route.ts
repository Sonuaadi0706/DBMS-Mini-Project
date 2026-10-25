import { api, readJson } from '@/lib/api/route';
import { ApiError, forbidden } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { query } from '@/lib/db/pg';
import { listProjects } from '@/lib/data/queries';
import { ProposalDraft } from '@/lib/validation/schemas';

export const GET = api(async (req) => {
  const user = await requireUser();
  const status = new URL(req.url).searchParams.get('status');
  return { proposals: await listProjects(user, status) };
});

// A student starts a draft for their own team. Which team is decided by the database, never the client.
export const POST = api(async (req) => {
  const user = await requireUser();
  if (!user.roles.includes('student')) throw forbidden('Only students can create proposals.');
  const body = ProposalDraft.parse(await readJson(req));
  const teams = await query<{ team_id: number; course_id: number }>(
    `SELECT t.team_id, t.course_id FROM team_members tm JOIN teams t ON t.team_id = tm.team_id WHERE tm.user_id = $1`, [user.userId]);
  const team = body.teamId ? teams.find((t) => t.team_id === body.teamId) : teams.length === 1 ? teams[0] : undefined;
  if (!team) {
    throw new ApiError(422, 'no_team', teams.length === 0 ? 'Create or join a team before writing a proposal.' : 'Choose which of your teams this proposal is for.');
  }
  const [row] = await query<{ project_id: number }>(
    `INSERT INTO projects(team_id, course_id, title, abstract, problem_statement, objectives, scope, domain, technologies, repo_link, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING project_id`,
    [team.team_id, team.course_id, body.title, body.abstract, body.problemStatement, body.objectives, body.scope,
      body.domain, body.technologies, body.repoLink, user.userId]);
  return { projectId: row.project_id };
}, 201);
