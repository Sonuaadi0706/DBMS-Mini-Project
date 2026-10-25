import { api, readJson } from '@/lib/api/route';
import { ApiError } from '@/lib/api/errors';
import { requireUser } from '@/lib/auth/session';
import { requireTeamMember } from '@/lib/auth/access';
import { withTransaction } from '@/lib/db/pg';
import { GitActivityBody } from '@/lib/validation/schemas';

// A student records a commit reference by hand (no GitHub sync in version 1). It becomes UNVERIFIED evidence.
export const POST = api(async (req) => {
  const user = await requireUser();
  const b = GitActivityBody.parse(await readJson(req));
  await requireTeamMember(user, b.projectId);
  const id = await withTransaction(user.userId, async (c) => {
    if (b.taskId) {
      const { rows } = await c.query(`SELECT 1 FROM tasks t JOIN milestones m ON m.milestone_id = t.milestone_id WHERE t.task_id = $1 AND m.project_id = $2`, [b.taskId, b.projectId]);
      if (!rows.length) throw new ApiError(422, 'validation', 'That task does not belong to this project.', { taskId: 'Unknown task' });
    }
    const { rows: [g] } = await c.query(
      `INSERT INTO git_activities(project_id, task_id, user_id, repo_url, commit_ref, commit_message, committed_at, recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$3) RETURNING git_id`,
      [b.projectId, b.taskId ?? null, user.userId, b.repoUrl, b.commitRef, b.commitMessage ?? null, b.committedAt ?? null]);
    await c.query(
      `INSERT INTO contribution_evidence(project_id, user_id, task_id, evidence_type, description, source_table, source_id)
       VALUES ($1,$2,$3,'git_activity',$4,'git_activities',$5)`,
      [b.projectId, user.userId, b.taskId ?? null, `Commit ${b.commitRef.slice(0, 7)}${b.commitMessage ? ': ' + b.commitMessage : ''}`.slice(0, 300), g.git_id]);
    return g.git_id as number;
  });
  return { gitId: id };
}, 201);
