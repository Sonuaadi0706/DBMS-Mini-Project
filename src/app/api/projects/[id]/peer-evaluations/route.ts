import { api, intParam, readJson } from '@/lib/api/route';
import { ApiError, forbidden } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { requireTeamMember } from '@/lib/auth/access';
import { withTransaction } from '@/lib/db/pg';
import { PeerEvaluationBody } from '@/lib/validation/schemas';

// A student rates a TEAMMATE for one milestone (the evaluation period). One rating per pair per period is a DB rule.
export const POST = api<{ id: string }>(async (req, { id }) => {
  const user = await requireUser();
  const projectId = intParam(id);
  const a = await requireTeamMember(user, projectId);
  if (a.isGuide || a.isReviewer) throw forbidden('Only students rate their teammates.');
  const b = PeerEvaluationBody.parse(await readJson(req));
  if (b.evaluateeId === user.userId) throw new ApiError(422, 'validation', 'You cannot rate yourself.', { evaluateeId: 'Choose a teammate' });
  await withTransaction(user.userId, async (c) => {
    const { rows: mate } = await c.query(
      `SELECT 1 FROM team_members tm JOIN projects p ON p.team_id = tm.team_id WHERE p.project_id = $1 AND tm.user_id = $2`, [projectId, b.evaluateeId]);
    if (!mate.length) throw new ApiError(422, 'validation', 'That person is not in your team.', { evaluateeId: 'Choose a teammate' });
    const { rows: [m] } = await c.query(`SELECT status FROM milestones WHERE milestone_id = $1 AND project_id = $2`, [b.milestoneId, projectId]);
    if (!m) throw new ApiError(422, 'validation', 'That milestone does not belong to this project.', { milestoneId: 'Unknown milestone' });
    if (m.status === 'planned') throw new ApiError(409, 'not_started', 'You can rate teammates once the milestone has started.');
    await c.query(
      `INSERT INTO peer_evaluations(project_id, milestone_id, evaluator_id, evaluatee_id, score, comments) VALUES ($1,$2,$3,$4,$5,$6)`,
      [projectId, b.milestoneId, user.userId, b.evaluateeId, b.score, b.comments || null]);
  });
  return { ok: true };
}, 201);
