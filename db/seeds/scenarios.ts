import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ObjectId } from 'mongodb';
import type { Client } from 'pg';

/**
 * Demo scenarios (spec 17.1). Everything is dated relative to CURRENT_DATE so the overdue / at-risk
 * situations are visible whenever the demo is run.
 *
 * The data is written through the same triggers the application relies on (status-transition guard,
 * audit log, evidence generation, overdue flags) instead of being inserted "already finished".
 * Only timestamps are rewritten afterwards (see backdateHistory) so activity looks like it happened
 * over the past weeks.
 */

export interface SeedRefs { deptId: number; dbmsCourseId: number; seCourseId: number; templateId: number }

type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done' | 'verified';
/** [title, owner student no., collaborator student nos., effort hours, due (days from today), status, completed N days ago] */
type TaskRow = [string, number, number[], number, number, TaskStatus, number?];
interface Version { summary: string; ago: number; by: number }
interface Deliverable {
  type: string; title: string; versions: Version[];
  accept?: boolean; draft?: boolean; repo?: string; url?: string;
}
interface Proposal {
  title: string; abstract: string; problem: string; objectives: string; scope: string;
  domain: string; tech: string[]; repo: string;
}

const CRITERIA = ['Completeness', 'Technical quality', 'Clarity and structure', 'Adherence to plan'];

const riskLevel = (s: number) => (s < 25 ? 'low' : s < 50 ? 'moderate' : s < 75 ? 'high' : 'critical');
const sha = (s: string, alg = 'sha256') => createHash(alg).update(s).digest('hex');

const PROPOSALS: Record<string, Proposal> = {
  alpha: {
    title: 'CampusConnect: Event Management and Volunteer Coordination Portal',
    abstract: 'CampusConnect is a web portal that lets student clubs create campus events, publish schedules, manage registrations and recruit volunteers. Organisers assign volunteers to event slots while attendees receive reminders and check in using QR codes.',
    problem: 'Clubs coordinate events and volunteers through scattered chat groups and spreadsheets, which causes double bookings, missed volunteer shifts and no record of participation.',
    objectives: '1. Provide one place to create and approve campus events. 2. Automate volunteer slot allocation and reminders. 3. Track attendance with QR check-in. 4. Report participation per club.',
    scope: 'Event creation, registration, volunteer rostering, QR attendance and basic analytics for one campus. Payments and ticketing are excluded.',
    domain: 'Campus Management', tech: ['Next.js', 'PostgreSQL', 'Node.js'], repo: 'https://github.com/projectpulse-demo/campusconnect',
  },
  bravo: {
    title: 'LibrarySeat: Real-Time Study Seat Reservation with Occupancy Analytics',
    abstract: 'LibrarySeat lets students reserve study seats in the central library, shows live occupancy of each floor and releases seats that are not claimed in time. Librarians get usage analytics to plan opening hours and seating.',
    problem: 'Students queue at the library entrance for seats during exams, and unused reserved-by-bag seats stay blocked for hours with no data on real occupancy.',
    objectives: '1. Online seat reservation with automatic release. 2. Live floor-wise occupancy view. 3. Usage analytics for librarians. 4. Fair-use limits per student.',
    scope: 'Seat reservation, check-in and release, occupancy dashboard and weekly usage reports for the central library only.',
    domain: 'Library Services', tech: ['React', 'Express', 'PostgreSQL', 'WebSockets'], repo: 'https://github.com/projectpulse-demo/libraryseat',
  },
  charlie: {
    title: 'ClinicQueue: Appointment Scheduling with Wait-Time Estimation',
    abstract: 'ClinicQueue lets patients of a campus health centre book appointment slots and see an estimated waiting time based on the live queue and past consultation durations. Doctors get a daily schedule and staff can handle walk-ins.',
    problem: 'Patients at the campus health centre wait for unpredictable periods because walk-ins and booked visits are not coordinated and nobody can estimate how long the queue will take.',
    objectives: '1. Slot booking for doctors. 2. Wait-time estimate from historical consultation durations. 3. Walk-in queue management. 4. Daily schedule view for doctors.',
    scope: 'Booking, queue tracking, wait-time estimation and doctor schedule for a single health centre. Medical records are excluded.',
    domain: 'Healthcare', tech: ['Next.js', 'PostgreSQL', 'Redis'], repo: 'https://github.com/projectpulse-demo/clinicqueue',
  },
  delta: {
    title: 'AgriAdvisor: Crop Disease Reporting and Advisory Portal',
    abstract: 'AgriAdvisor allows farmers to report crop disease symptoms with photographs and receive advisory notes from agricultural experts. Reports are mapped by village so extension officers can spot outbreaks early.',
    problem: 'Farmers in remote villages notice crop diseases late and have no quick way to reach an expert, so treatment is delayed and outbreaks spread before officers hear about them.',
    objectives: '1. Simple disease reporting with photos. 2. Expert advisory responses tracked per report. 3. Village-wise outbreak map. 4. Seasonal advisory library.',
    scope: 'Report submission, expert advisory workflow, village outbreak dashboard and advisory library for one district. Automatic image diagnosis is excluded.',
    domain: 'Agriculture', tech: ['Next.js', 'PostgreSQL', 'MongoDB'], repo: 'https://github.com/projectpulse-demo/agriadvisor',
  },
  echo: {
    title: 'CollegeEvents Hub: Campus Event Management and Volunteer Coordination Platform',
    abstract: 'CollegeEvents Hub is a web platform that lets student clubs create campus events, publish schedules, manage registrations and coordinate volunteers. Organisers assign volunteers to event shifts while attendees receive reminders and check in with QR codes.',
    problem: 'Student clubs coordinate events and volunteers through scattered chat groups and spreadsheets, which leads to clashing bookings, forgotten volunteer shifts and no record of participation.',
    objectives: '1. Provide a single place to create and approve campus events. 2. Automate volunteer shift allocation and reminders. 3. Track attendance with QR check-in. 4. Report participation for each club.',
    scope: 'Event creation, registration, volunteer scheduling, QR attendance and basic analytics for one campus. Online payments and ticketing are excluded.',
    domain: 'Campus Management', tech: ['Next.js', 'PostgreSQL'], repo: 'https://github.com/projectpulse-demo/collegeevents-hub',
  },
  foxtrot: {
    title: 'FestFlow: Event Registration System',
    abstract: 'FestFlow is a registration system for college fests where participants sign up for events and receive confirmations. Organisers see live headcounts for each event and manage waiting lists.',
    problem: 'Fest registrations are collected through paper forms and shared links, producing duplicate entries, lost forms and no live headcount for organisers.',
    objectives: '1. Online registration for fest events. 2. Automatic confirmation and waiting list. 3. Live headcount per event. 4. Exportable participant lists.',
    scope: 'Registration, confirmation, waiting list and headcount for a three-day college fest. Online payments are excluded.',
    domain: 'Event Management', tech: ['Django', 'MySQL'], repo: 'https://github.com/projectpulse-demo/festflow',
  },
};

export async function seedScenarios(
  db: Client, users: Map<string, number>, ref: SeedRefs, step: (label: string) => void = () => undefined,
): Promise<void> {
  const S = (n: number) => users.get(`student${String(n).padStart(2, '0')}@projectpulse.test`)!;
  const G = (n: number) => users.get(`guide${n}@projectpulse.test`)!;
  const R = (n: number) => users.get(`reviewer${n}@projectpulse.test`)!;
  const ADMIN = users.get('admin@projectpulse.test')!;

  // ---- tiny helpers -------------------------------------------------------------------------
  const actor = (id: number) => db.query(`SELECT set_config('app.current_user_id', $1, true)`, [String(id)]);
  async function val<T = number>(sql: string, p: unknown[] = []): Promise<T> {
    const { rows } = await db.query(sql, p);
    return Object.values(rows[0])[0] as T;
  }

  // ---- teams and proposals ------------------------------------------------------------------
  async function createTeam(courseId: number, name: string, members: [number, string][]): Promise<number> {
    await actor(S(members[0][0]));
    const teamId = await val(`INSERT INTO teams(course_id, team_name, created_by) VALUES ($1,$2,$3) RETURNING team_id`,
      [courseId, name, S(members[0][0])]);
    for (const [i, [no, resp]] of members.entries()) {
      await db.query(
        `INSERT INTO team_members(team_id, course_id, user_id, member_role, responsibility) VALUES ($1,$2,$3,$4,$5)`,
        [teamId, courseId, S(no), i === 0 ? 'leader' : 'member', resp]);
    }
    return teamId;
  }

  async function createProject(teamId: number, courseId: number, leader: number, p: Proposal, startAgo: number | null) {
    await actor(S(leader));
    return val(
      `INSERT INTO projects(team_id, course_id, template_id, title, abstract, problem_statement, objectives, scope,
                            domain, technologies, repo_link, start_date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
               CASE WHEN $12::int IS NULL THEN NULL ELSE CURRENT_DATE - $12::int END, $13) RETURNING project_id`,
      [teamId, courseId, startAgo == null ? null : ref.templateId, p.title, p.abstract, p.problem, p.objectives,
        p.scope, p.domain, p.tech, p.repo, startAgo, S(leader)]);
  }

  async function submitProject(projectId: number, leader: number, ago: number) {
    await actor(S(leader));
    await db.query(`UPDATE projects SET status='submitted', submitted_at = now() - make_interval(days => $2::int) WHERE project_id=$1`, [projectId, ago]);
    await db.query(
      `INSERT INTO proposal_actions(project_id, actor_id, action, from_status, to_status, comments, created_at)
       VALUES ($1,$2,'submit','draft','submitted','Proposal submitted for review', now() - make_interval(days => $3::int))`,
      [projectId, S(leader), ago]);
  }

  async function decideProject(projectId: number, guide: number, action: 'approve' | 'request_revision', comments: string, ago: number) {
    await actor(guide);
    const to = action === 'approve' ? 'approved' : 'revision_requested';
    await db.query(
      `UPDATE projects SET status=$2::text, approved_by = CASE WHEN $2::text='approved' THEN $3::int END,
              approved_at = CASE WHEN $2::text='approved' THEN now() - make_interval(days => $4::int) END WHERE project_id=$1`,
      [projectId, to, guide, ago]);
    await db.query(
      `INSERT INTO proposal_actions(project_id, actor_id, action, from_status, to_status, comments, created_at)
       VALUES ($1,$2,$3,'submitted',$4,$5, now() - make_interval(days => $6::int))`,
      [projectId, guide, action, to, comments, ago]);
  }

  async function allocate(projectId: number, guide: number, reviewers: number[]) {
    await actor(ADMIN);
    await db.query(`INSERT INTO guide_allocations(project_id, user_id, allocation_role, allocated_by) VALUES ($1,$2,'guide',$3)`, [projectId, guide, ADMIN]);
    for (const r of reviewers) {
      await db.query(`INSERT INTO guide_allocations(project_id, user_id, allocation_role, allocated_by) VALUES ($1,$2,'reviewer',$3)`, [projectId, r, ADMIN]);
    }
  }

  /** Approved proposal -> project plan (milestones + mandatory deliverable types come from the template). */
  async function startWithTemplate(projectId: number, leader: number): Promise<number[]> {
    await actor(S(leader));
    await db.query(`UPDATE projects SET status='in_progress' WHERE project_id=$1`, [projectId]);
    const { rows } = await db.query(
      `INSERT INTO milestones(project_id, sequence_no, title, due_date, weightage)
       SELECT p.project_id, tm.sequence_no, tm.title, p.start_date + tm.offset_days, tm.weightage
         FROM projects p JOIN template_milestones tm ON tm.template_id = $2
        WHERE p.project_id = $1 RETURNING milestone_id, sequence_no`, [projectId, ref.templateId]);
    await db.query(
      `INSERT INTO milestone_required_deliverables(milestone_id, deliverable_type)
       SELECT m.milestone_id, unnest(tm.required_deliverable_types)
         FROM milestones m JOIN template_milestones tm ON tm.sequence_no = m.sequence_no AND tm.template_id = $2
        WHERE m.project_id = $1`, [projectId, ref.templateId]);
    return rows.sort((a, b) => a.sequence_no - b.sequence_no).map((r) => r.milestone_id as number);
  }

  // ---- tasks --------------------------------------------------------------------------------
  async function addTasks(msId: number, creator: number, guide: number, rows: TaskRow[]) {
    for (const [title, owner, collabs, effort, due, status, doneAgo] of rows) {
      await actor(S(creator));
      const id = await val(
        `INSERT INTO tasks(milestone_id, title, description, effort_hours, priority, planned_start_date,
                           planned_completion_date, due_date, created_by)
         VALUES ($1,$2,$3,$4,$5, CURRENT_DATE + $6::int - 5, CURRENT_DATE + $6::int, CURRENT_DATE + $6::int, $7) RETURNING task_id`,
        [msId, title, `${title} (seed data)`, effort, effort >= 10 ? 'high' : 'medium', due, S(creator)]);
      await db.query(`INSERT INTO task_assignments(task_id, user_id, assignment_type, assigned_by) VALUES ($1,$2,'owner',$3)`, [id, S(owner), S(creator)]);
      for (const c of collabs) {
        await db.query(`INSERT INTO task_assignments(task_id, user_id, assignment_type, assigned_by) VALUES ($1,$2,'collaborator',$3)`, [id, S(c), S(creator)]);
      }
      await actor(S(owner));
      const path: Record<TaskStatus, string[]> = {
        todo: [], in_progress: ['in_progress'], blocked: ['in_progress', 'blocked'],
        done: ['in_progress', 'done'], verified: ['in_progress', 'done'],
      };
      for (const s of path[status]) await db.query(`UPDATE tasks SET status=$2 WHERE task_id=$1`, [id, s]);
      if (status === 'verified') {
        await actor(guide);
        await db.query(`UPDATE tasks SET status='verified', verified_by=$2, verified_at=now() WHERE task_id=$1`, [id, guide]);
      }
      if (status === 'done' || status === 'verified') {
        // Not a status change, so the transition triggers stay quiet; this just records the real date.
        await db.query(`UPDATE tasks SET actual_completion_date = CURRENT_DATE - $2::int WHERE task_id=$1`, [id, doneAgo ?? 1]);
      }
    }
  }

  // ---- deliverables, reviews, milestones ----------------------------------------------------
  /** Seeded versions get a real (tiny) markdown file so downloads and text extraction work in the demo. */
  function writeSeedFile(key: string, content: string): { size: number; checksum: string } {
    const full = path.resolve(process.cwd(), process.env.STORAGE_LOCAL_PATH ?? './storage/uploads', key);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
    return { size: Buffer.byteLength(content), checksum: sha(content) };
  }

  async function addDeliverable(msId: number, submitter: number, d: Deliverable): Promise<number> {
    await actor(S(submitter));
    const lastAgo = Math.min(...d.versions.map((v) => v.ago));
    const id = await val(
      `INSERT INTO deliverables(milestone_id, deliverable_type, title, repo_link, evidence_url, mongo_doc_id, status, submitted_by, submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, CASE WHEN $9::int IS NULL THEN NULL ELSE now() - make_interval(days => $9::int) END)
       RETURNING deliverable_id`,
      [msId, d.type, d.title, d.repo ?? null, d.url ?? null, new ObjectId().toHexString(), d.draft ? 'draft' : 'submitted', S(submitter), d.draft ? null : lastAgo]);
    for (const [i, v] of d.versions.entries()) {
      await actor(S(v.by));
      const name = `${d.type}_v${i + 1}.md`;
      const key = `seed/m${msId}/d${id}/${name}`;
      const body = `# ${d.title}\n\nVersion ${i + 1}\n\nChange summary: ${v.summary}\n\n_Seeded demo document for ProjectPulse._\n`;
      const f = writeSeedFile(key, body);
      await db.query(
        `INSERT INTO document_versions(deliverable_id, change_summary, file_name, file_url, file_size_bytes, checksum_sha256, uploaded_by, uploaded_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7, now() - make_interval(days => $8::int))`,
        [id, v.summary, name, key, f.size, f.checksum, S(v.by), v.ago]);
    }
    return id;
  }

  async function newReview(msId: number, reviewer: number, ago: number, type = 'milestone'): Promise<number> {
    await actor(reviewer);
    return val(`INSERT INTO reviews(milestone_id, reviewer_id, review_type, created_at) VALUES ($1,$2,$3, now() - make_interval(days => $4::int)) RETURNING review_id`,
      [msId, reviewer, type, ago]);
  }

  async function decideReview(reviewId: number, reviewer: number, decision: string, comments: string, scores: number[], ago: number) {
    await actor(reviewer);
    for (const [i, c] of CRITERIA.entries()) {
      await db.query(`INSERT INTO review_scores(review_id, criterion, max_score, score) VALUES ($1,$2,25,$3)`, [reviewId, c, scores[i]]);
    }
    await db.query(
      `UPDATE reviews SET decision=$2, comments=$3, total_score=$4, review_date = CURRENT_DATE - $5::int WHERE review_id=$1`,
      [reviewId, decision, comments, scores.reduce((a, b) => a + b, 0), ago]);
  }

  interface MsFlow {
    submitter: number; guide: number; submittedAgo: number; reviewAgo: number;
    deliverables: Deliverable[]; extraReviewer?: number; reviewerApproves?: boolean;
  }

  /** planned -> in_progress -> submitted -> under_review (pending review rows exist). Returns review ids. */
  async function submitForReview(msId: number, f: MsFlow, reviewers: number[]): Promise<{ reviewIds: number[]; deliverableIds: number[] }> {
    await actor(S(f.submitter));
    await db.query(`UPDATE milestones SET status='in_progress' WHERE milestone_id=$1`, [msId]);
    const deliverableIds: number[] = [];
    for (const d of f.deliverables) deliverableIds.push(await addDeliverable(msId, f.submitter, d));
    await actor(S(f.submitter));
    await db.query(`UPDATE milestones SET status='submitted', submitted_at = now() - make_interval(days => $2::int) WHERE milestone_id=$1`, [msId, f.submittedAgo]);
    await actor(f.guide);
    await db.query(`UPDATE milestones SET status='under_review' WHERE milestone_id=$1`, [msId]);
    const reviewIds: number[] = [];
    for (const r of reviewers) reviewIds.push(await newReview(msId, r, f.reviewAgo));
    return { reviewIds, deliverableIds };
  }

  /** Full happy path ending in an approved milestone. Returns the guide's review id (for feedback). */
  async function approvedMilestone(msId: number, f: MsFlow, o: { approvedAgo: number; score: number[]; comments: string; reviewerScore?: number[] }) {
    const reviewers = f.extraReviewer ? [f.guide, f.extraReviewer] : [f.guide];
    const { reviewIds, deliverableIds } = await submitForReview(msId, f, reviewers);
    await actor(f.guide);
    for (const id of deliverableIds) await db.query(`UPDATE deliverables SET status='accepted' WHERE deliverable_id=$1`, [id]);
    await decideReview(reviewIds[0], f.guide, 'approved', o.comments, o.score, o.approvedAgo);
    if (f.extraReviewer) {
      await decideReview(reviewIds[1], f.extraReviewer, 'approved', 'Meets the milestone criteria; documentation is clear.', o.reviewerScore ?? o.score, o.approvedAgo);
    }
    await db.query(
      `UPDATE milestones SET status='approved', approved_by=$2, approved_at = now() - make_interval(days => $3::int), approval_comments=$4 WHERE milestone_id=$1`,
      [msId, f.guide, o.approvedAgo, o.comments]);
    // The guide checks the uploads of an accepted deliverable, so that evidence now counts.
    await db.query(
      `UPDATE contribution_evidence SET verified_flag=TRUE, verified_by=$2, verified_at=now()
        WHERE evidence_type='document_upload' AND source_table='document_versions'
          AND source_id IN (SELECT dv.version_id FROM document_versions dv JOIN deliverables d USING (deliverable_id)
                             WHERE d.milestone_id=$1 AND d.status='accepted')`, [msId, f.guide]);
    return reviewIds[0];
  }

  // ---- feedback -----------------------------------------------------------------------------
  type FbStatus = 'open' | 'in_progress' | 'resolved' | 'verified' | 'reopened';
  async function addFeedback(reviewId: number, by: number, assignee: number, text: string,
    o: { severity: 'minor' | 'major' | 'critical'; due: number; createdAgo: number; status: FbStatus; resolvedAgo?: number }) {
    await actor(by);
    const id = await val(
      `INSERT INTO feedback_items(review_id, created_by, assigned_user_id, description, severity, due_date, created_at)
       VALUES ($1,$2,$3,$4,$5, CURRENT_DATE + $6::int, now() - make_interval(days => $7::int)) RETURNING feedback_id`,
      [reviewId, by, S(assignee), text, o.severity, o.due, o.createdAgo]);
    const resolve = async () => {
      await actor(S(assignee));
      await db.query(
        `UPDATE feedback_items SET resolution_status='resolved', resolved_at = now() - make_interval(days => $2::int), response_text=$3 WHERE feedback_id=$1`,
        [id, o.resolvedAgo ?? 1, 'Addressed as suggested; please check the updated section.']);
    };
    if (o.status === 'in_progress') {
      await actor(S(assignee));
      await db.query(`UPDATE feedback_items SET resolution_status='in_progress' WHERE feedback_id=$1`, [id]);
    } else if (o.status === 'resolved') {
      await resolve();
    } else if (o.status === 'verified') {
      await resolve();
      await actor(by);
      await db.query(`UPDATE feedback_items SET resolution_status='verified', verified_by=$2, verified_at = now() - make_interval(days => $3::int) WHERE feedback_id=$1`,
        [id, by, Math.max(0, (o.resolvedAgo ?? 1) - 1)]);
    } else if (o.status === 'reopened') {
      await resolve();
      await actor(by);
      await db.query(`UPDATE feedback_items SET resolution_status='reopened' WHERE feedback_id=$1`, [id]);
    }
    return id;
  }

  // ---- misc evidence ------------------------------------------------------------------------
  async function addGit(projectId: number, user: number, guide: number, repo: string, msg: string, ago: number, verified: boolean) {
    const ref40 = sha(`${repo}-${msg}-${ago}`, 'sha1');
    const gid = await val(
      `INSERT INTO git_activities(project_id, user_id, repo_url, commit_ref, commit_message, committed_at, recorded_by)
       VALUES ($1,$2,$3,$4,$5, now() - make_interval(days => $6::int), $2) RETURNING git_id`, [projectId, S(user), repo, ref40, msg, ago]);
    await db.query(
      `INSERT INTO contribution_evidence(project_id, user_id, evidence_type, description, verified_flag, verified_by, verified_at, source_table, source_id)
       VALUES ($1,$2,'git_activity',$3,$4,$5,CASE WHEN $4 THEN now() END,'git_activities',$6)`,
      [projectId, S(user), left(`Commit ${ref40.slice(0, 7)}: ${msg}`), verified, verified ? guide : null, gid]);
  }
  const left = (s: string) => s.slice(0, 300);

  async function addPeer(projectId: number, msId: number, from: number, to: number, score: number, comment: string) {
    await actor(S(from));
    await db.query(
      `INSERT INTO peer_evaluations(project_id, milestone_id, evaluator_id, evaluatee_id, score, comments) VALUES ($1,$2,$3,$4,$5,$6)`,
      [projectId, msId, S(from), S(to), score, comment]);
  }

  // =========================================================================================
  //  ALPHA (DBMS) - healthy team, balanced evidence -> low risk
  // =========================================================================================
  step('Alpha');
  const alphaTeam = await createTeam(ref.dbmsCourseId, 'Alpha', [[1, 'Database design and backend'], [2, 'API and integration'], [3, 'Frontend and testing']]);
  const alpha = await createProject(alphaTeam, ref.dbmsCourseId, 1, PROPOSALS.alpha, 50);
  await submitProject(alpha, 1, 58);
  await allocate(alpha, G(1), [R(1)]);
  await decideProject(alpha, G(1), 'approve', 'Clear problem and realistic scope. Approved.', 54);
  const [aM1, aM2, aM3, aM4, aM5] = await startWithTemplate(alpha, 1);

  await addTasks(aM1, 1, G(1), [
    ['Draft problem statement', 1, [], 4, -42, 'verified', 44],
    ['Literature survey of event portals', 2, [], 6, -40, 'verified', 41],
    ['Prepare proposal presentation', 3, [], 4, -38, 'verified', 39],
    ['Compile and submit proposal document', 1, [2], 2, -37, 'verified', 38],
  ]);
  const alphaR1 = await approvedMilestone(aM1, {
    submitter: 1, guide: G(1), submittedAgo: 38, reviewAgo: 37, extraReviewer: undefined,
    deliverables: [{ type: 'proposal', title: 'CampusConnect proposal', versions: [
      { summary: 'Initial proposal draft', ago: 44, by: 1 }, { summary: 'Added scope and objectives after guide comments', ago: 38, by: 2 }] }],
  }, { approvedAgo: 36, score: [21, 20, 22, 23], comments: 'Well-structured proposal.' });
  void alphaR1;

  await addTasks(aM2, 1, G(1), [
    ['Interview organisers and gather requirements', 1, [], 8, -28, 'verified', 29],
    ['Write functional requirements', 2, [], 10, -24, 'verified', 25],
    ['Write non-functional requirements', 3, [], 6, -22, 'verified', 23],
    ['Draw use-case diagrams', 1, [], 6, -20, 'verified', 21],
    ['Volunteer rostering requirements', 3, [], 8, -18, 'verified', 19],
    ['SRS review and polish', 2, [3], 5, -17, 'verified', 18],
  ]);
  const alphaR2 = await approvedMilestone(aM2, {
    submitter: 2, guide: G(1), submittedAgo: 17, reviewAgo: 16, extraReviewer: R(1),
    deliverables: [{ type: 'srs', title: 'CampusConnect SRS', versions: [
      { summary: 'First full draft', ago: 26, by: 2 }, { summary: 'Incorporated organiser feedback', ago: 20, by: 3 },
      { summary: 'Final SRS after peer review', ago: 17, by: 2 }] }],
  }, { approvedAgo: 15, score: [20, 19, 21, 22], comments: 'Requirements are testable. Volunteer rules need examples.', reviewerScore: [21, 20, 21, 22] });
  await addFeedback(alphaR2, G(1), 3, 'Add concrete examples for volunteer shift-clash rules in section 3.4.',
    { severity: 'minor', due: -8, createdAgo: 16, status: 'verified', resolvedAgo: 12 });
  await addFeedback(alphaR2, G(1), 2, 'Clarify how event approval by the faculty coordinator is represented in the data model.',
    { severity: 'major', due: 6, createdAgo: 4, status: 'in_progress' });

  await addTasks(aM3, 1, G(1), [
    ['Draw ER diagram', 2, [], 10, -2, 'verified', 3],
    ['Relational schema and DDL', 1, [], 12, 3, 'done', 1],
    ['Event and volunteer module wireframes', 3, [], 8, 5, 'in_progress'],
    ['Index and view design', 2, [], 6, 7, 'in_progress'],
    ['Normalisation write-up', 3, [], 5, 8, 'todo'],
    ['Design document review', 1, [], 4, 9, 'todo'],
  ]);
  await actor(S(1));
  await db.query(`UPDATE milestones SET status='in_progress' WHERE milestone_id=$1`, [aM3]);
  await addDeliverable(aM3, 2, { type: 'design_doc', title: 'CampusConnect design document (draft)', draft: true,
    versions: [{ summary: 'ER diagram and first schema draft', ago: 2, by: 2 }] });
  await addTasks(aM4, 1, G(1), [
    ['Implement authentication and roles', 1, [], 8, 22, 'todo'], ['Event CRUD API', 2, [], 10, 26, 'todo'],
    ['Volunteer scheduling UI', 3, [], 12, 30, 'todo'], ['System test plan', 3, [2], 6, 33, 'todo'],
  ]);
  await addTasks(aM5, 1, G(1), [['Final report', 1, [2, 3], 12, 46, 'todo'], ['Demo rehearsal', 3, [1, 2], 4, 49, 'todo']]);
  const alphaRepo = 'https://github.com/projectpulse-demo/campusconnect';
  await addGit(alpha, 1, G(1), alphaRepo, 'Add base schema migration', 6, true);
  await addGit(alpha, 2, G(1), alphaRepo, 'Event table with constraints', 5, true);
  await addGit(alpha, 3, G(1), alphaRepo, 'Wireframes for volunteer view', 3, false);
  await addGit(alpha, 2, G(1), alphaRepo, 'ER diagram export', 2, false);
  await addPeer(alpha, aM2, 1, 2, 5, 'Reliable and writes clear requirements.');
  await addPeer(alpha, aM2, 1, 3, 4, 'Good with the frontend.');
  await addPeer(alpha, aM2, 2, 1, 5, 'Keeps the database design consistent.');
  await addPeer(alpha, aM2, 2, 3, 4, 'Delivers on time.');
  await addPeer(alpha, aM2, 3, 1, 5, 'Always available for questions.');
  await addPeer(alpha, aM2, 3, 2, 4.5, 'Great at integrating the pieces.');

  // =========================================================================================
  //  BRAVO (DBMS) - delayed: M2 overdue, 4 overdue tasks, SRS missing, no activity 11+ days
  // =========================================================================================
  step('Bravo');
  const bravoTeam = await createTeam(ref.dbmsCourseId, 'Bravo', [[4, 'Backend and database'], [5, 'Frontend and analytics']]);
  const bravo = await createProject(bravoTeam, ref.dbmsCourseId, 4, PROPOSALS.bravo, 47);
  await submitProject(bravo, 4, 55);
  await allocate(bravo, G(2), [R(1)]);
  await decideProject(bravo, G(2), 'approve', 'Approved. Keep the analytics scope small.', 50);
  const [bM1, bM2, bM3] = await startWithTemplate(bravo, 4);
  await addTasks(bM1, 4, G(2), [
    ['Write problem statement', 4, [], 6, -40, 'verified', 41],
    ['Survey existing seat-booking apps', 4, [], 6, -38, 'verified', 39],
    ['Proposal slides', 5, [], 4, -35, 'verified', 36],
  ]);
  const bravoR1 = await approvedMilestone(bM1, {
    submitter: 4, guide: G(2), submittedAgo: 36, reviewAgo: 35,
    deliverables: [{ type: 'proposal', title: 'LibrarySeat proposal', versions: [{ summary: 'Proposal document', ago: 38, by: 4 }] }],
  }, { approvedAgo: 33, score: [18, 17, 18, 19], comments: 'Acceptable. Plan the SRS early.' });
  await addFeedback(bravoR1, G(2), 5, 'Define how a seat is released when a student does not check in; add this to the requirements plan.',
    { severity: 'major', due: -8, createdAgo: 30, status: 'open' });
  await actor(S(4));
  await db.query(`UPDATE milestones SET status='in_progress' WHERE milestone_id=$1`, [bM2]);
  await addTasks(bM2, 4, G(2), [
    ['Interview library staff', 4, [], 4, -25, 'in_progress'],
    ['Requirements for seat map', 5, [], 6, -20, 'todo'],
    ['Occupancy analytics requirements', 5, [], 6, -15, 'blocked'],
    ['Write SRS draft', 4, [5], 10, -8, 'in_progress'],
  ]);
  await addTasks(bM3, 4, G(2), [['ER diagram for seats and bookings', 4, [], 8, 11, 'todo'], ['Schema design', 5, [], 8, 12, 'todo']]);

  // =========================================================================================
  //  CHARLIE (DBMS) - contribution imbalance: student06 carries ~80% of verified evidence
  // =========================================================================================
  step('Charlie');
  const charlieTeam = await createTeam(ref.dbmsCourseId, 'Charlie', [[6, 'Full-stack development'], [7, 'Documentation'], [8, 'Testing']]);
  const charlie = await createProject(charlieTeam, ref.dbmsCourseId, 6, PROPOSALS.charlie, 40);
  await submitProject(charlie, 6, 48);
  await allocate(charlie, G(1), [R(2)]);
  await decideProject(charlie, G(1), 'approve', 'Approved.', 44);
  const [cM1, cM2, cM3] = await startWithTemplate(charlie, 6);
  await addTasks(cM1, 6, G(1), [
    ['Problem statement and objectives', 6, [], 8, -33, 'verified', 34],
    ['Study of queueing models', 6, [], 8, -31, 'verified', 32],
    ['Proposal slides', 6, [], 8, -29, 'verified', 30],
    ['Proposal document', 6, [], 8, -28, 'verified', 29],
    ['Literature references', 7, [], 4, -30, 'verified', 31],
    ['Test idea list', 8, [], 4, -29, 'verified', 30],
  ]);
  const charlieR1 = await approvedMilestone(cM1, {
    submitter: 6, guide: G(1), submittedAgo: 28, reviewAgo: 27,
    deliverables: [{ type: 'proposal', title: 'ClinicQueue proposal', versions: [
      { summary: 'First proposal', ago: 32, by: 6 }, { summary: 'Reworked scope', ago: 28, by: 6 }] }],
  }, { approvedAgo: 26, score: [19, 18, 19, 20], comments: 'Good start.' });
  await addFeedback(charlieR1, G(1), 8, 'List the test scenarios for walk-in versus booked patients.',
    { severity: 'minor', due: -15, createdAgo: 27, status: 'verified', resolvedAgo: 20 });
  await addTasks(cM2, 6, G(1), [
    ['Requirements gathering with clinic staff', 6, [], 8, -14, 'done', 12],
    ['SRS use cases', 6, [], 8, -10, 'done', 8],
    ['SRS sections 1 to 3', 7, [], 6, -4, 'in_progress'],
    ['Acceptance criteria', 8, [], 4, -3, 'in_progress'],
  ]);
  const cm2 = await submitForReview(cM2, {
    submitter: 6, guide: G(1), submittedAgo: 6, reviewAgo: 5,
    deliverables: [{ type: 'srs', title: 'ClinicQueue SRS', versions: [
      { summary: 'SRS draft 1', ago: 9, by: 6 }, { summary: 'SRS draft 2 with queue rules', ago: 6, by: 6 }] }],
  }, [G(1), R(2)]);
  void cm2;
  await addTasks(cM3, 6, G(1), [['ER diagram', 6, [], 8, 18, 'todo'], ['Schema and triggers', 6, [7], 10, 22, 'todo']]);
  await addGit(charlie, 6, G(1), 'https://github.com/projectpulse-demo/clinicqueue', 'Scaffold app and DB', 9, false);
  await addGit(charlie, 6, G(1), 'https://github.com/projectpulse-demo/clinicqueue', 'Booking API prototype', 4, false);
  await addPeer(charlie, cM1, 7, 6, 5, 'Carries most of the work.');
  await addPeer(charlie, cM1, 8, 6, 5, 'Does the heavy lifting.');
  await addPeer(charlie, cM1, 6, 7, 3, 'Delivers late.');
  await addPeer(charlie, cM1, 6, 8, 2, 'Hard to reach.');
  await addPeer(charlie, cM1, 7, 8, 2, 'Rarely contributes.');
  await addPeer(charlie, cM1, 8, 7, 3, 'Helps with documents.');

  // =========================================================================================
  //  DELTA (DBMS) - unresolved feedback and a missing test report
  // =========================================================================================
  step('Delta');
  const deltaTeam = await createTeam(ref.dbmsCourseId, 'Delta', [[9, 'Backend and database'], [10, 'Frontend and advisory content']]);
  const delta = await createProject(deltaTeam, ref.dbmsCourseId, 9, PROPOSALS.delta, 80);
  await submitProject(delta, 9, 90);
  await allocate(delta, G(2), [R(2)]);
  await decideProject(delta, G(2), 'approve', 'Approved. Strong societal value.', 85);
  const [dM1, dM2, dM3, dM4] = await startWithTemplate(delta, 9);
  await addTasks(dM1, 9, G(2), [
    ['Problem statement', 9, [], 4, -72, 'verified', 73], ['Survey of agri advisory apps', 10, [], 6, -70, 'verified', 71],
    ['Proposal slides', 9, [10], 4, -67, 'verified', 68],
  ]);
  await approvedMilestone(dM1, {
    submitter: 9, guide: G(2), submittedAgo: 68, reviewAgo: 67,
    deliverables: [{ type: 'proposal', title: 'AgriAdvisor proposal', versions: [{ summary: 'Proposal', ago: 70, by: 9 }] }],
  }, { approvedAgo: 66, score: [20, 19, 20, 21], comments: 'Approved.' });
  await addTasks(dM2, 9, G(2), [
    ['Farmer interviews', 10, [], 6, -55, 'verified', 56], ['Functional requirements', 9, [], 8, -52, 'verified', 53],
    ['Non-functional requirements', 10, [], 6, -49, 'verified', 50], ['SRS compile', 9, [10], 5, -46, 'verified', 47],
  ]);
  await approvedMilestone(dM2, {
    submitter: 9, guide: G(2), submittedAgo: 47, reviewAgo: 46,
    deliverables: [{ type: 'srs', title: 'AgriAdvisor SRS', versions: [
      { summary: 'SRS v1', ago: 52, by: 9 }, { summary: 'SRS v2 with advisory workflow', ago: 47, by: 10 }] }],
  }, { approvedAgo: 45, score: [21, 20, 21, 21], comments: 'Solid SRS.' });
  await addTasks(dM3, 9, G(2), [
    ['ER diagram', 9, [], 8, -33, 'verified', 34], ['Relational schema', 10, [], 8, -30, 'verified', 31],
    ['Constraint and index plan', 9, [], 6, -27, 'verified', 28], ['Advisory workflow design', 10, [], 6, -24, 'verified', 25],
    ['Design document', 9, [10], 6, -22, 'verified', 23],
  ]);
  const deltaR3 = await approvedMilestone(dM3, {
    submitter: 10, guide: G(2), submittedAgo: 22, reviewAgo: 21,
    deliverables: [{ type: 'design_doc', title: 'AgriAdvisor design document', versions: [
      { summary: 'Design v1', ago: 28, by: 10 }, { summary: 'Design v2 after review', ago: 22, by: 9 }] }],
  }, { approvedAgo: 20, score: [19, 20, 18, 20], comments: 'Approved with a list of follow-up items to be closed before the next milestone.' });
  // Follow-up items raised on the design review: every workflow state is represented.
  const fb = (text: string, who: number, o: Parameters<typeof addFeedback>[4]) => addFeedback(deltaR3, G(2), who, text, o);
  await fb('Add an index plan for outbreak queries by village and date.', 9, { severity: 'major', due: -4, createdAgo: 18, status: 'open' });
  await fb('Document how photo uploads are size-limited and validated.', 10, { severity: 'major', due: 3, createdAgo: 18, status: 'open' });
  await fb('Describe the escalation path when an expert does not reply within 48 hours.', 10, { severity: 'minor', due: 5, createdAgo: 17, status: 'in_progress' });
  await fb('The village outbreak view needs a defined refresh strategy.', 9, { severity: 'critical', due: -1, createdAgo: 16, status: 'reopened', resolvedAgo: 8 });
  await fb('Rename ambiguous columns in the advisory table.', 10, { severity: 'minor', due: 2, createdAgo: 15, status: 'resolved', resolvedAgo: 2 });
  await fb('Add a data dictionary appendix.', 9, { severity: 'minor', due: -10, createdAgo: 18, status: 'verified', resolvedAgo: 12 });
  await addTasks(dM4, 9, G(2), [
    ['Disease report form and API', 9, [], 12, 2, 'done', 4], ['Advisory content module', 10, [], 12, 3, 'done', 3],
    ['Unit and integration tests', 10, [9], 10, 3, 'in_progress'], ['Test report write-up', 9, [], 6, 4, 'todo'],
    ['Capture application screenshots', 9, [], 2, 4, 'done', 1],
  ]);
  const dm4 = await submitForReview(dM4, {
    submitter: 9, guide: G(2), submittedAgo: 1, reviewAgo: 1,
    deliverables: [
      { type: 'source_code', title: 'AgriAdvisor source code', repo: 'https://github.com/projectpulse-demo/agriadvisor',
        versions: [{ summary: 'Core modules', ago: 4, by: 9 }, { summary: 'Advisory module merged', ago: 1, by: 10 }] },
      { type: 'screenshot', title: 'AgriAdvisor screenshots', url: 'https://example.org/agriadvisor/screens',
        versions: [{ summary: 'Main screens', ago: 1, by: 9 }] },
    ],
  }, [G(2), R(2)]);
  void dm4;
  await addGit(delta, 9, G(2), 'https://github.com/projectpulse-demo/agriadvisor', 'Report form validation', 5, true);
  await addGit(delta, 10, G(2), 'https://github.com/projectpulse-demo/agriadvisor', 'Advisory module', 3, false);

  // =========================================================================================
  //  ECHO (DBMS) - submitted, near-duplicate of Alpha -> pending similarity review
  // =========================================================================================
  step('Echo and Foxtrot');
  const echoTeam = await createTeam(ref.dbmsCourseId, 'Echo', [[11, 'Backend'], [12, 'Frontend']]);
  const echo = await createProject(echoTeam, ref.dbmsCourseId, 11, PROPOSALS.echo, null);
  await submitProject(echo, 11, 3);
  await allocate(echo, G(1), []);

  // FOXTROT (Software Engineering course) - similar topic, other course; revision requested
  const foxTeam = await createTeam(ref.seCourseId, 'Foxtrot', [[13, 'Backend'], [14, 'Frontend and documentation']]);
  const fox = await createProject(foxTeam, ref.seCourseId, 13, PROPOSALS.foxtrot, null);
  await submitProject(fox, 13, 6);
  await allocate(fox, G(3), []);
  await decideProject(fox, G(3), 'request_revision', 'Narrow the scope to registration only and add measurable objectives.', 4);

  await backdateHistory(db, { alpha, bravo, charlie, delta }, ADMIN, step);
  await riskHistory(db, { alpha, bravo, charlie, delta }, step);

  step('Risk sweep');
  await actor(ADMIN);
  await db.query('CALL sp_run_risk_sweep()');
}

/**
 * The workflow above ran "now"; this makes the data look like it grew over weeks. Only timestamps
 * change (never statuses). The updated_at trigger is disabled just for this one statement because its
 * whole job is to overwrite updated_at with now().
 */
async function backdateHistory(
  db: Client, p: { alpha: number; bravo: number; charlie: number; delta: number }, _admin: number, step: (l: string) => void,
) {
  step('Backdating history');
  // Days since the team last touched an open task. Bravo has been silent for 13 days.
  const lag = new Map<number, number>([[p.alpha, 1], [p.bravo, 13], [p.charlie, 1], [p.delta, 1]]);
  await db.query('ALTER TABLE tasks DISABLE TRIGGER trg_tasks_updated');
  await db.query(
    `UPDATE tasks t
        SET updated_at = CASE WHEN t.status IN ('done','verified')
                              THEN LEAST(now(), t.actual_completion_date::timestamptz + interval '15 hours')
                              ELSE now() - make_interval(days => COALESCE(l.days, 1)) END,
            verified_at = CASE WHEN t.status = 'verified'
                               THEN LEAST(now(), t.actual_completion_date::timestamptz + interval '20 hours') END,
            created_at = LEAST(now(), COALESCE(t.actual_completion_date::timestamptz, now())) - interval '14 days'
       FROM milestones m
       LEFT JOIN unnest($1::int[], $2::int[]) AS l(project_id, days) ON l.project_id = m.project_id
      WHERE m.milestone_id = t.milestone_id`,
    [[...lag.keys()], [...lag.values()]]);
  await db.query('ALTER TABLE tasks ENABLE TRIGGER trg_tasks_updated');

  // Evidence takes the date of the thing it came from.
  await db.query(
    `UPDATE contribution_evidence ce SET created_at = t.updated_at,
            verified_at = CASE WHEN ce.verified_flag THEN t.verified_at END
       FROM tasks t WHERE ce.source_table='tasks' AND ce.source_id = t.task_id`);
  await db.query(
    `UPDATE contribution_evidence ce SET created_at = dv.uploaded_at,
            verified_at = CASE WHEN ce.verified_flag THEN LEAST(now(), dv.uploaded_at + interval '2 days') END
       FROM document_versions dv WHERE ce.source_table='document_versions' AND ce.source_id = dv.version_id`);
  await db.query(
    `UPDATE contribution_evidence ce SET created_at = f.resolved_at, verified_at = CASE WHEN ce.verified_flag THEN f.verified_at END
       FROM feedback_items f WHERE ce.source_table='feedback_items' AND ce.source_id = f.feedback_id`);
  await db.query(
    `UPDATE contribution_evidence ce SET created_at = g.committed_at,
            verified_at = CASE WHEN ce.verified_flag THEN LEAST(now(), g.committed_at + interval '1 day') END
       FROM git_activities g WHERE ce.source_table='git_activities' AND ce.source_id = g.git_id`);
  // Overdue flags were raised when each milestone was created today. A milestone approved on or before its due
  // date was never really overdue, so its flag is dropped; the others are dated from the day after the due date.
  await db.query(
    `DELETE FROM risk_events e USING milestones m
      WHERE e.milestone_id = m.milestone_id AND e.resolved_at IS NOT NULL AND m.approved_at::date <= m.due_date`);
  await db.query(
    `UPDATE risk_events e
        SET created_at = LEAST(now(), (m.due_date + 1)::timestamptz),
            resolved_at = CASE WHEN e.resolved_at IS NOT NULL THEN m.approved_at END
       FROM milestones m WHERE e.milestone_id = m.milestone_id`);
}

/** 3 older snapshots per active project so the trend chart has something to draw. */
async function riskHistory(db: Client, p: { alpha: number; bravo: number; charlie: number; delta: number }, step: (l: string) => void) {
  step('Risk history');
  const snapshots: [number, [number, number][]][] = [   // [project, [[days ago, score], ...]]
    [p.alpha, [[22, 14], [15, 9], [8, 6]]],
    [p.bravo, [[22, 8], [15, 25], [8, 43]]],
    [p.charlie, [[22, 6], [15, 12], [8, 19]]],
    [p.delta, [[22, 18], [15, 20], [8, 24]]],
  ];
  for (const [project, rows] of snapshots) {
    for (const [ago, score] of rows) {
      await db.query(
        `INSERT INTO risk_assessments(project_id, risk_score, risk_level, reason, breakdown, calculated_at)
         VALUES ($1,$2,$3,'Earlier weekly assessment', '{}', now() - make_interval(days => $4::int))`,
        [project, score, riskLevel(score), ago]);
    }
  }
}
