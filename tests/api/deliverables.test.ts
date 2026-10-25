import { beforeAll, describe, expect, it } from 'vitest';
import { ObjectId } from 'mongodb';
import { em, login, projectIdByTitle, serverUp, type Client } from './helpers';
import { mongo, sql, uploadedFiles } from './stores';

/**
 * Deliverables, uploads and the atomic milestone submission (T-15, T-16, T-17, T-20).
 * CHANGES data (submits and approves Alpha's milestone 3), so it needs ALLOW_MUTATING_TESTS=1 and a server
 * started with ENABLE_TEST_HOOKS=1 (see README). Restore the demo afterwards with db:reset + db:seed.
 */
const up = await serverUp();
let hooksOn = false;
if (up && process.env.ALLOW_MUTATING_TESTS === '1') {
  // Probe: on a milestone that is still `planned`, a hook-enabled server fails step 1 (500) while a normal
  // server answers 409 "start the milestone first". Nothing is changed either way.
  const admin = await login(em.admin);
  const student = await login(em.student(1));
  const alpha = await projectIdByTitle(admin, 'CampusConnect');
  const m4 = (await student.get(`/api/projects/${alpha}/milestones`)).body.milestones.find((m: any) => m.sequence_no === 4);
  hooksOn = (await student.form(`/api/milestones/${m4.milestone_id}/submit`, {}, undefined, { 'x-test-fail-at': '1' })).status === 500;
}
const d = hooksOn ? describe : describe.skip;

const md = (text: string) => ({ name: 'notes.md', content: text, type: 'text/markdown' });

d('deliverables and atomic submission (Alpha, milestone 3)', () => {
  let admin: Client, s1: Client, s2: Client, bravoStudent: Client, guide1: Client, reviewer1: Client;
  let alpha: number, m3: number, draftId: number;

  const state = async () => ({
    milestone: (await sql(`SELECT status FROM milestones WHERE milestone_id = $1`, [m3]))[0].status as string,
    deliverables: Number((await sql(`SELECT COUNT(*) AS n FROM deliverables WHERE milestone_id = $1`, [m3]))[0].n),
    submitted: Number((await sql(`SELECT COUNT(*) AS n FROM deliverables WHERE milestone_id = $1 AND status = 'submitted'`, [m3]))[0].n),
    versions: Number((await sql(`SELECT COUNT(*) AS n FROM document_versions dv JOIN deliverables d USING (deliverable_id) WHERE d.milestone_id = $1`, [m3]))[0].n),
    pendingReviews: Number((await sql(`SELECT COUNT(*) AS n FROM reviews WHERE milestone_id = $1 AND decision = 'pending'`, [m3]))[0].n),
    audits: Number((await sql(`SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'MILESTONE_SUBMITTED' AND entity_id = $1`, [String(m3)]))[0].n),
    files: uploadedFiles().length,
  });
  const mongoDocs = (title: string) => mongo((db) => db.collection('documents').countDocuments({ title }));

  beforeAll(async () => {
    [admin, s1, s2, bravoStudent, guide1, reviewer1] = await Promise.all([
      login(em.admin), login(em.student(1)), login(em.student(2)), login(em.student(4)), login(em.guide(1)), login('reviewer1@projectpulse.test'),
    ]);
    alpha = await projectIdByTitle(admin, 'CampusConnect');
    const ms = (await s1.get(`/api/projects/${alpha}/milestones`)).body.milestones;
    m3 = ms.find((m: any) => m.sequence_no === 3).milestone_id;
    draftId = (await s1.get(`/api/milestones/${m3}/deliverables`)).body.deliverables.find((x: any) => x.status === 'draft').deliverable_id;
  });

  // ---------------------------------------------------------------- uploads
  it('T-17/T-20: stores an uploaded file, numbers versions, deletes a draft, and keeps files out of public reach', async () => {
    const before = uploadedFiles().length;
    const r = await s1.form(`/api/milestones/${m3}/deliverables`, { deliverableType: 'screenshot', title: 'Wireframe screenshots', changeSummary: 'First wireframes' }, md('# wireframes\nlogin, events'));
    expect(r.status).toBe(201);
    expect(uploadedFiles().length).toBe(before + 1);
    const delId = r.body.deliverableId;
    const ver = (await s1.get(`/api/milestones/${m3}/deliverables`)).body.deliverables.find((x: any) => x.deliverable_id === delId).versions[0];
    expect(ver.fileUrl).toMatch(/^\d{6}\/[0-9a-f-]{36}\.md$/);           // random name, never the original
    expect(ver.fileName).toBe('notes.md');

    const own = await s1.raw(`/api/files/${ver.versionId}`);
    expect(own.status).toBe(200);
    expect(own.bytes.toString()).toContain('wireframes');
    expect(own.headers.get('x-content-type-options')).toBe('nosniff');
    expect(own.headers.get('content-disposition')).toContain('attachment');
    expect([403, 404]).toContain((await bravoStudent.raw(`/api/files/${ver.versionId}`)).status);   // T-05: other team
    expect((await login(null).then((c) => c.raw(`/api/files/${ver.versionId}`))).status).toBe(401);
    // Mongo document is confirmed and linked to the deliverable
    const doc = await mongo((db) => db.collection('documents').findOne({ deliverableId: delId }));
    expect(doc).toMatchObject({ state: 'confirmed', documentType: 'Other', projectId: alpha });
    expect(doc!.extractedText).toContain('wireframes');
    // A teammate uploads version 2; numbering is assigned by the database (T-17)
    const v2 = await s2.form(`/api/deliverables/${delId}/versions`, { changeSummary: 'Added the event screens' }, md('# wireframes v2'));
    expect(v2.body.versionNumber).toBe(2);
    expect((await mongo((db) => db.collection('documents').findOne({ deliverableId: delId })))!.versions).toHaveLength(2);
    expect((await bravoStudent.form(`/api/deliverables/${delId}/versions`, { changeSummary: 'hijack' }, md('x'))).status).toBeGreaterThanOrEqual(403);
    // a draft can be deleted: row, version file, evidence and Mongo document all go
    const key = (await sql(`SELECT file_url FROM document_versions WHERE deliverable_id = $1 ORDER BY version_number`, [delId])).map((r) => r.file_url);
    expect((await s1.del(`/api/deliverables/${delId}`)).status).toBe(200);
    expect(uploadedFiles().length).toBe(before);
    expect(key).toHaveLength(2);
    expect(await mongo((db) => db.collection('documents').countDocuments({ deliverableId: delId }))).toBe(0);
    expect(Number((await sql(`SELECT COUNT(*) AS n FROM deliverables WHERE deliverable_id = $1`, [delId]))[0].n)).toBe(0);
  });

  it('rejects dangerous or invalid uploads and leaves nothing behind', async () => {
    const base = { deliverableType: 'other', title: 'Probe upload', changeSummary: 'probe' };
    const before = await state();
    const exe = await s1.form(`/api/milestones/${m3}/deliverables`, base, { name: 'run.exe', content: 'MZ....' });
    expect(exe.status).toBe(422);
    const fake = await s1.form(`/api/milestones/${m3}/deliverables`, base, { name: 'report.pdf', content: 'this is not a pdf' });
    expect(fake.status).toBe(422);
    expect(fake.body.error.message).toContain('does not look like');
    const big = await s1.form(`/api/milestones/${m3}/deliverables`, base, { name: 'big.txt', content: 'a'.repeat(11 * 1024 * 1024) });
    expect(big.status).toBe(422);
    const noFile = await s1.form(`/api/milestones/${m3}/deliverables`, base);
    expect(noFile.status).toBe(422);
    const noSummary = await s1.form(`/api/milestones/${m3}/deliverables`, { ...base, changeSummary: '' }, md('x'));
    expect(noSummary.status).toBe(422);
    expect(noSummary.body.error.fields.changeSummary).toBeTruthy();
    // a path-traversal file name is neutralised
    const sneaky = await s1.form(`/api/milestones/${m3}/deliverables`, { ...base, title: 'Probe sneaky name' }, { name: '../../../etc/passwd.txt', content: 'plain text' });
    expect(sneaky.status).toBe(201);
    const v = (await sql(`SELECT file_name, file_url FROM document_versions WHERE deliverable_id = $1`, [sneaky.body.deliverableId]))[0];
    expect(v.file_name).toBe('passwd.txt');
    expect(v.file_url).not.toContain('..');
    expect((await s1.del(`/api/deliverables/${sneaky.body.deliverableId}`)).status).toBe(200);
    const after = await state();
    expect(after).toMatchObject({ deliverables: before.deliverables, versions: before.versions, files: before.files });
    expect(await mongoDocs('Probe upload')).toBe(0);
  });

  // ---------------------------------------------------------------- T-15 rollback
  it('T-15: a bad version payload (negative size) fails at step 3 and EVERYTHING rolls back', async () => {
    const before = await state();
    const r = await s1.post(`/api/milestones/${m3}/submit`, {
      deliverableType: 'design_doc', title: 'Rollback probe A', changeSummary: 'bad size', linkUrl: 'https://example.org/probe.pdf', fileSizeBytes: -5,
    });
    expect(r.status).toBe(422);
    const after = await state();
    expect(after).toEqual(before);                                   // no deliverable, version, review, audit; status unchanged
    expect(after.milestone).toBe('in_progress');
    expect(await mongoDocs('Rollback probe A')).toBe(0);             // pending Mongo document removed (compensation)
    expect((await sql(`SELECT status FROM deliverables WHERE deliverable_id = $1`, [draftId]))[0].status).toBe('draft');
  });

  for (const step of [5, 6]) {
    it(`T-15: a failure at step ${step} (with a file) rolls back, removes the file and the Mongo document`, async () => {
      const before = await state();
      const r = await s1.form(`/api/milestones/${m3}/submit`,
        { deliverableType: 'design_doc', title: `Rollback probe step ${step}`, changeSummary: 'will fail' }, md('# should vanish'), { 'x-test-fail-at': String(step) });
      expect(r.status).toBe(500);
      expect(r.body.error.code).toBe('test_hook');
      expect(await state()).toEqual(before);                         // includes file count on disk
      expect(await mongoDocs(`Rollback probe step ${step}`)).toBe(0);
    });
  }

  it('T-15: submitting a milestone that has not been started is refused and changes nothing', async () => {
    const before = await state();
    const empty = (await s1.get(`/api/projects/${alpha}/milestones`)).body.milestones.find((m: any) => m.sequence_no === 4);
    expect((await s1.form(`/api/milestones/${empty.milestone_id}/submit`, {})).status).toBe(409);   // not started
    expect(await state()).toEqual(before);
  });

  // ---------------------------------------------------------------- T-16 success + review cycle
  it('T-16: a valid submission creates deliverable, version, status, review requests and audit row together', async () => {
    const before = await state();
    const r = await s1.form(`/api/milestones/${m3}/submit`,
      { deliverableType: 'design_doc', title: 'CampusConnect design document', changeSummary: 'Final ER diagram and schema' }, md('# Design\n\nER diagram and schema.'));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: 'submitted', draftsSubmitted: 1 });
    expect(r.body.reviewRequests).toBe(2);                           // guide1 + reviewer1
    const after = await state();
    expect(after).toMatchObject({ milestone: 'submitted', submitted: before.submitted + 2, versions: before.versions + 1,
      pendingReviews: before.pendingReviews + 2, audits: before.audits + 1, files: before.files + 1 });
    const del = (await sql(`SELECT * FROM deliverables WHERE deliverable_id = $1`, [r.body.newDeliverableId]))[0];
    expect(del.status).toBe('submitted');
    const doc = await mongo((db) => db.collection('documents').findOne({ _id: new ObjectId(del.mongo_doc_id) }));
    expect(doc).toMatchObject({ state: 'confirmed', deliverableId: r.body.newDeliverableId, documentType: 'Design' });
    expect(Number((await sql(`SELECT COUNT(*) AS n FROM contribution_evidence WHERE evidence_type = 'document_upload' AND NOT verified_flag AND source_id IN (SELECT version_id FROM document_versions WHERE deliverable_id = $1)`, [del.deliverable_id]))[0].n)).toBe(1);
    expect((await s1.form(`/api/milestones/${m3}/submit`, {})).status).toBe(409);        // cannot submit twice
  });

  it('guide reviews: starts review, returns one deliverable, requests revision; team reworks and resubmits', async () => {
    expect((await s1.post(`/api/milestones/${m3}/decision`, { action: 'review' })).status).toBe(403);
    expect((await guide1.post(`/api/milestones/${m3}/decision`, { action: 'review' })).body.status).toBe('under_review');
    const dels = (await guide1.get(`/api/milestones/${m3}/deliverables`)).body.deliverables;
    const original = dels.find((x: any) => x.deliverable_id === draftId);
    expect((await s1.post(`/api/deliverables/${original.deliverable_id}/decision`, { action: 'reject' })).status).toBe(403);
    expect((await guide1.post(`/api/deliverables/${original.deliverable_id}/decision`, { action: 'reject' })).body.status).toBe('rejected');
    const noReason = await guide1.post(`/api/milestones/${m3}/decision`, { action: 'request_revision' });
    expect(noReason.status).toBe(422);
    expect((await guide1.post(`/api/milestones/${m3}/decision`, { action: 'request_revision', comments: 'Normalisation notes are missing from the first draft.' })).body.status).toBe('revision_requested');

    // rework: a returned deliverable gets a new version (back to draft), the milestone resumes, then resubmits
    expect((await s1.form(`/api/deliverables/${original.deliverable_id}/versions`, { changeSummary: 'Too early' }, md('x'))).status).toBe(201);
    expect((await sql(`SELECT status FROM deliverables WHERE deliverable_id = $1`, [original.deliverable_id]))[0].status).toBe('draft');
    expect((await s1.post(`/api/milestones/${m3}/start`)).body.status).toBe('in_progress');
    const re = await s1.post(`/api/milestones/${m3}/submit`, {});
    expect(re.status).toBe(200);
    expect(re.body.draftsSubmitted).toBe(1);
    expect(re.body.reviewRequests).toBeGreaterThanOrEqual(1);
  });

  it('T-20/T-25: guide approves once the mandatory deliverable is present; a submitted deliverable cannot be deleted', async () => {
    expect((await guide1.post(`/api/milestones/${m3}/decision`, { action: 'review' })).status).toBe(200);
    const ok = await guide1.post(`/api/milestones/${m3}/decision`, { action: 'approve', comments: 'Good design.' });
    expect(ok.body.status).toBe('approved');
    expect((await sql(`SELECT COUNT(*)::int AS n FROM deliverables WHERE milestone_id = $1 AND status <> 'accepted'`, [m3]))[0].n).toBe(0);
    expect((await s1.del(`/api/deliverables/${draftId}`)).status).toBe(409);                  // T-20: submitted work cannot be deleted
  });

  it('files: a reviewer allocated to the project can read uploads', async () => {
    const dels = (await reviewer1.get(`/api/milestones/${m3}/deliverables`)).body.deliverables;
    const withFile = dels.flatMap((x: any) => x.versions).find((v: any) => v.fileUrl && !/^https?:/.test(v.fileUrl));
    expect((await reviewer1.raw(`/api/files/${withFile.versionId}`)).status).toBe(200);
  });
});
