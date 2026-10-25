import { beforeAll, describe, expect, it } from 'vitest';
import { em, login, projectIdByTitle, serverUp, type Client } from './helpers';
import { mongo, sql } from './stores';

/**
 * Reviews, feedback workflow, discussion threads (MongoDB), evidence verification and git references (Delta team).
 * CHANGES data; needs ALLOW_MUTATING_TESTS=1. Restore the demo afterwards with db:reset + db:seed.
 */
const enabled = (await serverUp()) && process.env.ALLOW_MUTATING_TESTS === '1';
const d = enabled ? describe : describe.skip;

d('review and feedback workflow (Delta)', () => {
  let admin: Client, s9: Client, s10: Client, guide2: Client, reviewer2: Client, alphaStudent: Client;
  let delta: number, id9: number, id10: number, name10: string, guide2Id: number, alphaStudentId: number;
  let items: any[];

  const list = async (c: Client) => (await c.get(`/api/projects/${delta}/feedback`)).body.feedback as any[];
  const byText = (arr: any[], part: string) => arr.find((f) => f.description.includes(part));
  const threadDoc = (feedbackId: number) => mongo((db) => db.collection('feedback_threads').findOne({ feedbackId }));

  beforeAll(async () => {
    [admin, s9, s10, guide2, reviewer2, alphaStudent] = await Promise.all([
      login(em.admin), login(em.student(9)), login(em.student(10)), login(em.guide(2)), login('reviewer2@projectpulse.test'), login(em.student(1)),
    ]);
    delta = await projectIdByTitle(admin, 'AgriAdvisor');
    id9 = (await s9.get('/api/auth/me')).body.user.userId;
    id10 = (await s10.get('/api/auth/me')).body.user.userId;
    name10 = (await s10.get('/api/auth/me')).body.user.name;
    guide2Id = (await guide2.get('/api/auth/me')).body.user.userId;
    alphaStudentId = (await alphaStudent.get('/api/auth/me')).body.user.userId;
    items = await list(guide2);
  });

  it('students see only the feedback assigned to them; staff see all of it (permission matrix 4.1)', async () => {
    expect(items).toHaveLength(6);
    const mine9 = await list(s9);
    const mine10 = await list(s10);
    expect(mine9.length).toBeGreaterThan(0);
    expect(mine9.every((f) => f.assigned_user_id === id9)).toBe(true);
    expect(mine10.every((f) => f.assigned_user_id === id10)).toBe(true);
    expect(mine9.length + mine10.length).toBe(6);
    expect((await list(reviewer2)).length).toBe(6);
    expect([403, 404]).toContain((await alphaStudent.get(`/api/projects/${delta}/feedback`)).status);
  });

  it('T-05: another student, even in the same team, cannot act on or read someone else\'s feedback', async () => {
    const forNine = items.find((f) => f.assigned_user_id === id9 && f.resolution_status === 'open');
    expect((await s10.post(`/api/feedback/${forNine.feedback_id}/respond`, { responseText: 'not mine' })).status).toBe(404);
    expect((await s10.get(`/api/feedback/${forNine.feedback_id}/thread`)).status).toBe(404);
    expect((await alphaStudent.get(`/api/feedback/${forNine.feedback_id}/thread`)).status).toBe(404);
    expect((await sql(`SELECT resolution_status FROM feedback_items WHERE feedback_id = $1`, [forNine.feedback_id]))[0].resolution_status).toBe('open');
  });

  it('respond -> resolve -> verify; evidence is created unverified and becomes verified with the item', async () => {
    const f = items.find((x) => x.assigned_user_id === id9 && x.resolution_status === 'open');
    const id = f.feedback_id;
    expect((await s9.post(`/api/feedback/${id}/resolve`, {})).status).toBe(422);              // nothing explained yet
    expect((await s9.post(`/api/feedback/${id}/respond`, { responseText: '' })).status).toBe(422);
    expect((await s9.post(`/api/feedback/${id}/respond`, { responseText: 'Added a composite index on (village, reported_on).' })).body.status).toBe('in_progress');
    expect((await guide2.post(`/api/feedback/${id}/respond`, { responseText: 'guide cannot answer for the student' })).status).toBe(403);
    expect((await s9.post(`/api/feedback/${id}/resolve`, {})).body.status).toBe('resolved');
    const ev = () => sql(`SELECT verified_flag FROM contribution_evidence WHERE source_table = 'feedback_items' AND source_id = $1`, [id]);
    expect((await ev())[0].verified_flag).toBe(false);
    expect((await s9.post(`/api/feedback/${id}/verify`)).status).toBe(403);                  // a student cannot verify their own work
    expect((await guide2.post(`/api/feedback/${id}/verify`)).body.status).toBe('verified');
    expect((await ev())[0].verified_flag).toBe(true);
    expect((await guide2.post(`/api/feedback/${id}/verify`)).status).toBe(409);               // already verified
    expect((await s9.post(`/api/feedback/${id}/respond`, { responseText: 'too late' })).status).toBe(409);
    expect((await threadDoc(id))!.status).toBe('verified');                                    // mirrored into MongoDB
  });

  it('a reopened item can be resolved again; the guide can reopen a resolved item with a comment (thread keeps it)', async () => {
    const reopened = items.find((x) => x.assigned_user_id === id9 && x.resolution_status === 'reopened');
    expect((await s9.post(`/api/feedback/${reopened.feedback_id}/resolve`, { responseText: 'Documented the refresh strategy (nightly materialised view).' })).body.status).toBe('resolved');

    const resolved = items.find((x) => x.assigned_user_id === id10 && x.resolution_status === 'resolved');
    expect((await guide2.post(`/api/feedback/${resolved.feedback_id}/reopen`, { comment: 'Names are still ambiguous in two tables.' })).body.status).toBe('reopened');
    const t = (await s10.get(`/api/feedback/${resolved.feedback_id}/thread`)).body;
    expect(t.status).toBe('reopened');
    expect(t.messages.at(-1)).toMatchObject({ text: 'Names are still ambiguous in two tables.', authorName: expect.any(String) });
    const open = items.find((x) => x.resolution_status === 'in_progress');
    expect((await guide2.post(`/api/feedback/${open.feedback_id}/reopen`)).status).toBe(409);   // only resolved items
    expect((await guide2.post(`/api/feedback/${open.feedback_id}/verify`)).status).toBe(409);
  });

  it('guide raises new feedback on a review; it is assigned to a team member and gets a Mongo thread', async () => {
    const ms = (await guide2.get(`/api/projects/${delta}/milestones`)).body.milestones;
    const m4 = ms.find((m: any) => m.sequence_no === 4).milestone_id;
    const review = await guide2.post(`/api/milestones/${m4}/reviews`);
    expect(review.status).toBe(201);
    expect((await s9.post(`/api/milestones/${m4}/reviews`)).status).toBe(403);
    const body = { assignedUserId: id10, description: 'Add a test for duplicate village reports.', severity: 'major', dueDate: '2030-01-15', theme: 'testing' };
    expect((await s10.post(`/api/reviews/${review.body.reviewId}/feedback`, body)).status).toBe(403);
    const outsider = await guide2.post(`/api/reviews/${review.body.reviewId}/feedback`, { ...body, assignedUserId: alphaStudentId });
    expect(outsider.status).toBe(422);
    expect(outsider.body.error.message).toContain('not a member');
    const ok = await guide2.post(`/api/reviews/${review.body.reviewId}/feedback`, body);
    expect(ok.status).toBe(201);
    const doc = await threadDoc(ok.body.feedbackId);
    expect(doc).toMatchObject({ theme: 'testing', status: 'open', projectId: delta });
    expect(doc!.messages).toHaveLength(1);
  });

  it('threads: participants post, admins only read, empty messages are refused', async () => {
    const f = (await list(s10))[0];
    expect((await s10.post(`/api/feedback/${f.feedback_id}/thread`, { text: '   ' })).status).toBe(422);
    expect((await s10.post(`/api/feedback/${f.feedback_id}/thread`, { text: 'Can we discuss this on Friday?' })).status).toBe(201);
    expect((await guide2.post(`/api/feedback/${f.feedback_id}/thread`, { text: 'Friday works.' })).status).toBe(201);
    expect((await admin.post(`/api/feedback/${f.feedback_id}/thread`, { text: 'hello' })).status).toBe(403);
    const t = (await admin.get(`/api/feedback/${f.feedback_id}/thread`)).body;
    expect(t.messages.slice(-2).map((m: any) => m.role)).toEqual(['student', 'faculty_guide']);
  });

  it('reviews: rubric total is derived; invalid scores are refused; the guide decides via the milestone, not the review', async () => {
    const reviews = (await guide2.get(`/api/projects/${delta}/reviews`)).body.reviews as any[];
    const m4Guide = reviews.find((r) => r.sequence_no === 4 && r.reviewer_id === guide2Id);
    const m4Rev = reviews.find((r) => r.sequence_no === 4 && r.reviewer_id !== guide2Id);
    const bad = await guide2.patch(`/api/reviews/${m4Guide.review_id}`, { scores: [{ criterion: 'Completeness', maxScore: 25, score: 30 }] });
    expect(bad.status).toBe(422);
    const dup = await guide2.patch(`/api/reviews/${m4Guide.review_id}`, { scores: [{ criterion: 'A', maxScore: 25, score: 1 }, { criterion: 'a', maxScore: 25, score: 2 }] });
    expect(dup.status).toBe(422);
    expect((await guide2.patch(`/api/reviews/${m4Guide.review_id}`, { comments: 'Draft comments', scores: [
      { criterion: 'Completeness', maxScore: 25, score: 20 }, { criterion: 'Quality', maxScore: 25, score: 15 }] })).status).toBe(200);
    const after = ((await guide2.get(`/api/projects/${delta}/reviews`)).body.reviews as any[]).find((r) => r.review_id === m4Guide.review_id);
    expect(Number(after.total_score)).toBe(70);
    expect(after.scores).toHaveLength(2);
    expect((await guide2.patch(`/api/reviews/${m4Guide.review_id}`, { decision: 'approved' })).status).toBe(422);
    expect((await guide2.patch(`/api/reviews/${m4Rev.review_id}`, { comments: 'not yours' })).status).toBe(403);
    expect((await s9.patch(`/api/reviews/${m4Guide.review_id}`, { comments: 'student' })).status).toBe(403);
    expect((await reviewer2.patch(`/api/reviews/${m4Rev.review_id}`, { decision: 'revision_requested', comments: 'Test report is missing.' })).status).toBe(200);
    expect((await reviewer2.patch(`/api/reviews/${m4Rev.review_id}`, { decision: 'approved' })).status).toBe(409);
  });

  it('evidence: students see only their own; only the guide verifies; verifying twice is refused', async () => {
    const mine = (await s10.get(`/api/projects/${delta}/evidence`)).body.evidence as any[];
    const all = (await guide2.get(`/api/projects/${delta}/evidence`)).body.evidence as any[];
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((e) => e.user_name === name10)).toBe(true);
    expect(all.length).toBeGreaterThan(mine.length);
    const unverified = all.find((e) => !e.verified_flag);
    expect((await s10.post(`/api/evidence/${unverified.evidence_id}/verify`)).status).toBe(403);
    expect((await guide2.post(`/api/evidence/${unverified.evidence_id}/verify`)).status).toBe(200);
    expect((await guide2.post(`/api/evidence/${unverified.evidence_id}/verify`)).status).toBe(409);
    expect((await sql(`SELECT verified_by IS NOT NULL AS ok FROM contribution_evidence WHERE evidence_id = $1`, [unverified.evidence_id]))[0].ok).toBe(true);
  });

  it('git references: recorded as unverified evidence; duplicates and bad input are refused', async () => {
    const body = { projectId: delta, repoUrl: 'https://github.com/projectpulse-demo/agriadvisor', commitRef: 'a1b2c3d4e5f6', commitMessage: 'Add duplicate report check' };
    const ok = await s9.post('/api/git-activities', body);
    expect(ok.status).toBe(201);
    expect((await sql(`SELECT verified_flag FROM contribution_evidence WHERE source_table = 'git_activities' AND source_id = $1`, [ok.body.gitId]))[0].verified_flag).toBe(false);
    expect((await s9.post('/api/git-activities', body)).status).toBe(409);
    expect((await s9.post('/api/git-activities', { ...body, commitRef: 'bad ref!' })).status).toBe(422);
    expect((await s9.post('/api/git-activities', { ...body, commitRef: 'ffff0000', repoUrl: 'ftp://nope' })).status).toBe(422);
    expect([403, 404]).toContain((await alphaStudent.post('/api/git-activities', { ...body, commitRef: 'eeee1111' })).status);
  });
});
