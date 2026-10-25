<div class="cover">

<h1>ProjectPulse</h1>
<div class="sub">Academic Project Governance, Originality and Milestone Risk Monitor</div>

<table>
<tr><td>Course</td><td>DBMS Experiential Learning, Level 3 Project</td></tr>
<tr><td>Instructor</td><td>Dr. Nagasundari S</td></tr>
<tr><td>Team</td><td>Chiranthan and Aadish</td></tr>
<tr><td>Domain</td><td>Education Technology / Academic Project Management</td></tr>
<tr><td>Databases</td><td>PostgreSQL (SQL) · MongoDB (NoSQL) · PostgreSQL with pgvector (vector)</td></tr>
<tr><td>Application</td><td>Next.js (App Router) with Route Handlers</td></tr>
<tr><td>Date</td><td>{{date}}</td></tr>
</table>

</div>

# Contents

<ol class="toc">
<li>Problem statement and motivation</li><li>Objectives</li><li>Scope</li><li>Functional requirements</li><li>ER diagram</li>
<li>Relational schema</li><li>Database choice and justification</li><li>Data dictionary</li><li>SQL implementation</li>
<li>NoSQL implementation (MongoDB)</li><li>Vector implementation (pgvector)</li><li>Important queries</li>
<li>System architecture and security design</li><li>Application screenshots</li><li>Testing results</li>
<li>Conclusion and future enhancements</li><li>Team contributions and repository</li><li>References</li>
<li>Appendix A: complete data dictionary</li><li>Appendix B: how to run the project</li>
</ol>

# 1. Problem statement and motivation

In colleges, student teams working on mini-projects, capstones, dissertations and research assignments often face late or missed milestones, unclear task ownership, unequal individual contribution, incomplete documentation, unresolved faculty feedback, and project proposals that substantially overlap with other teams. Faculty guides commonly discover these issues only near final submission, when there is little time left to intervene, correct the scope, recover missed work, or assess individual participation fairly.

**ProjectPulse** is a web-based academic project-governance platform. Students, faculty guides, reviewers and administrators manage the complete project lifecycle in one place: proposal, team formation, guide allocation, milestone planning, task allocation, evidence submission, document-version tracking, feedback resolution, approval workflows, contribution evidence, and delivery-risk monitoring. The system also uses **semantic similarity search** to flag potentially overlapping project proposals for faculty review.

The platform gives explainable progress, contribution and risk indicators based on recorded evidence (verified task completion, document uploads, feedback resolution, milestone status and deadlines). It supports faculty judgement; it never grades automatically and never declares plagiarism.

**Why it matters**

- A faculty member supervises many teams at once and needs a single dashboard to see which projects are late or at risk, *before* the final week.
- A final report alone is weak evidence of who did what, how the work evolved, or whether feedback was acted on.
- Teams need a clear, shared way to plan work, split responsibilities, submit evidence and answer guide feedback.
- An institution needs an early signal when two proposals describe the same idea, before both teams spend weeks building it.
- Governance and fairness improve while humans keep the final say on grades and originality.

# 2. Objectives

1. Provide a structured workflow from proposal approval to final evaluation.
2. Track teams, guides, milestones, tasks, deadlines, deliverables, document versions, reviews and feedback.
3. Keep evidence-based contribution records for every team member.
4. Calculate **explainable** delivery-risk levels from overdue work, missing evidence, unresolved feedback, inactivity and contribution imbalance.
5. Offer role-based dashboards for students, faculty guides, reviewers and administrators.
6. Use semantic similarity search to retrieve and flag conceptually similar proposals for faculty review.
7. Demonstrate practical SQL, NoSQL, vector-database and advanced DBMS concepts through a working Next.js application.

# 3. Scope

**Included:** proposal approval with immutable history, role-based access, team and guide allocation, milestone and task tracking, deliverable submission with version history and file upload, faculty feedback workflow with discussion threads, contribution evidence and peer evaluation, risk analytics, dashboards and filtered reports with CSV export, document storage, semantic proposal-similarity screening, an audit log, and an administration area (users, roles, departments, courses, project templates, allocations).

**Out of scope (future work):** automated plagiarism verdicts, automated final grading, mandatory GitHub OAuth sync (commit references are entered manually), OCR of scanned documents, WhatsApp / e-mail delivery, and machine-learning risk prediction. In-app notifications and rate limiting were optional (P2) items and were not built (see section 16).

# 4. Functional requirements

All P0 (must) and P1 (should) requirements of the specification are implemented and covered by automated tests; of the P2 (nice-to-have) items, CSV export and free-text semantic search are done.

| Area | Requirement | Status |
|---|---|---|
| Authentication | Email + password with salted bcrypt hashes; JWT in an HttpOnly cookie; logout and expiry (AUTH-01, 04) | Done |
| | Role-based access for Student, Faculty Guide, Reviewer, Admin in API and UI; role switcher for multi-role users (AUTH-02, 03) | Done |
| | Lockout after 5 failed logins for 15 minutes; change password; admin can suspend a user (AUTH-05, 06) | Done |
| Proposals | Draft, edit, submit, approve / reject / request revision with comments; immutable decision history; resubmission (PROP-01 to 06) | Done |
| | "Check originality" hint for students that reveals nothing about other teams (PROP-07) | Done |
| Teams | Create teams, add members, responsibilities, one leader; one team per student per course (database-enforced); guide and reviewer allocation; guide cannot be on the team (TEAM-01 to 04) | Done |
| Milestones and tasks | Dated, weighted milestones (total at most 100), templates, tasks with owner and collaborators, planned and actual dates, controlled workflow with guide verification, approval, Kanban board and timeline (MS-01 to 08) | Done |
| Deliverables | File upload or link, version numbers, metadata in PostgreSQL, flexible document in MongoDB, **atomic milestone submission**, mandatory-type detection (DEL-01 to 05) | Done |
| Review and feedback | Reviews with rubric scores, feedback items assigned to one student, respond / resolve / verify / reopen, MongoDB discussion thread (FB-01 to 04) | Done |
| Contribution | Evidence created automatically from verified tasks, uploads and feedback; manual commit references; peer evaluation; guide verification; student sees only their own record (CON-01 to 05) | Done |
| Risk | Low / moderate / high / critical with reasons, stored history, overdue-milestone trigger, sweep job (button and script) (RISK-01 to 04) | Done |
| Similarity | Embed on submit, top-k above a threshold with metadata filter, matching text and score for faculty, saved decision, no automatic verdict, free-text search (SIM-01 to 05) | Done |
| Dashboards and reports | Role dashboards; delayed teams, unapproved milestones, unresolved feedback, contribution imbalance, high-risk projects, missing deliverables; filters, sorting, CSV (DASH, RPT) | Done |
| Administration | Users, roles, departments, courses, templates, allocations, system reports; audit-log viewer (ADM-01, AUD-01) | Done |
| Not built (P2) | In-app notifications (NOT-01), login/similarity rate limiting, a full Content-Security-Policy | Future work |

# 5. ER diagram

The diagrams below are **generated from the live database catalogue** (`npm run docs:data-dictionary`): {{tables}} tables and {{relationships}} foreign-key relationships. One picture of all tables would be unreadable, so the schema is drawn as five connected domain diagrams. Inside a domain every attribute is shown with its type and its key marks (PK, FK, UK); a table drawn with only its key is referenced from another domain. A line with a circle at the parent end is an optional relationship (nullable foreign key); the crow's foot is the "many" side. "Who did it" columns such as `created_by`, `approved_by` and `verified_by` (all foreign keys to `users`) are marked FK inside the boxes but not drawn as lines, so the pictures stay readable; all of them are listed in Appendix A. The same diagrams are in `docs/er_*.mmd`, and `docs/er_diagram.mmd` holds the whole schema in one file.

<div class="wide">

<!--erdomains-->

</div>

**Reading the model.** *Identity and academic context*: departments, courses, users, roles, teams. *Project governance*: projects (one active per team), proposal actions, guide allocations, templates. *Delivery*: milestones, tasks, assignments, deliverables, versions. *Quality loop*: reviews, rubric scores, feedback items. *Evidence and analytics*: contribution evidence, git references, peer evaluations, risk assessments and events. *Originality*: project embeddings (pgvector) and similarity reviews. *Control*: status transitions (the allowed workflow edges), audit logs.

# 6. Relational schema

The relational schema below is generated from the same catalogue (underlined = primary key, italic = foreign key with its target). The full constraint detail (UNIQUE, CHECK, ON DELETE rules, indexes, triggers) is in Appendix A.

<!--file:docs/relational_schema.md-->

**Design decisions that shape the schema**

- A student is in at most one team per course. `team_members` carries `course_id` through a *composite* foreign key to `teams(team_id, course_id)` so that `UNIQUE (course_id, user_id)` is enforced by the database itself.
- A team has at most one *active* project, and no two active proposals in a course share a title: both are **partial unique indexes** (`WHERE status NOT IN ('rejected','archived')`), so a rejected proposal does not block a new one.
- Workflow is data: the table `status_transitions` lists every legal status change; a trigger consults it, so illegal jumps are impossible whichever client writes.
- Foreign keys use deliberate rules: `ON DELETE RESTRICT` for history that must never vanish (projects, milestones, reviews, evidence, audit), `CASCADE` for pure child rows, `SET NULL` for optional references.

# 7. Database choice and justification

The instructor's rule is that each kind of data must use the technology that suits its nature. ProjectPulse uses three paradigms, each for a specific need.

| Paradigm | Technology | What it stores | Why this technology fits |
|---|---|---|---|
| **SQL** | PostgreSQL | Users, roles, teams, projects, milestones, tasks, assignments, deliverable metadata, reviews, feedback, contribution evidence, risk assessments, audit logs, similarity decisions | The data is highly relational and rule-heavy. We need primary / foreign keys, CHECK constraints, transactions, views, triggers, stored functions and indexes. A workflow such as "may this task become *verified*?" or "may this milestone be approved?" must hold for every client, which only the database can guarantee. |
| **NoSQL** | MongoDB | Document records (versions, sections, tags, extracted text), feedback discussion threads, guide meeting notes, attachment metadata | A Software Requirements Specification, a test report and a meeting note have *different shapes*. Forcing them into fixed columns would create many NULLs or constant migrations. Threads are append-only lists of messages that grow without bound: a natural document. Aggregation pipelines summarise them directly. |
| **Vector** | PostgreSQL + pgvector | 384-dimensional embeddings of proposal sections | "Are these two abstracts about the same idea?" cannot be answered by `LIKE` or full-text search; it needs a meaning-based distance. Keeping vectors **inside PostgreSQL** lets one query combine the vector search with relational filters (course, current / rejected, access level). |

**Why not one database for everything?** Putting documents into relational columns, or workflow rules into a document store, would trade away either flexibility or integrity. PostgreSQL stays the **system of record** for workflow state; MongoDB documents reference it by integer ids. A write that spans both is ordered so that nothing can be left half-done: the MongoDB document is written first as `pending`, the SQL transaction runs, then the document is `confirmed`; if SQL rolls back, the pending document and any uploaded file are removed (section 9.4). A repair script (`npm run mongo:reconcile`) rebuilds the document side from PostgreSQL.

# 8. Data dictionary

The complete dictionary (every table with column, type, nullability, default, key and constraint, plus indexes and triggers) is generated from the catalogue and reproduced in **Appendix A**. Summary of the {{tables}} tables:

<!--tablesummary-->

# 9. SQL implementation

The database has {{tables}} tables, {{views}} views, {{functions}} functions and procedures, {{triggers}} triggers and {{indexes}} indexes, created by {{migrations}} versioned migration files in `db/migrations`. Each file is applied in one transaction by `npm run db:migrate`, with a progress bar (S-18); `npm run db:reset` rebuilds everything from nothing, which was done after every slice to prove the migrations are repeatable.

| File | Content |
|---|---|
| 001 | Extensions (`vector`, `citext`), schema, `updated_at` trigger function |
| 002 to 006 | Tables: identity, projects and templates, milestones and tasks, deliverables / reviews / feedback, evidence / risk / similarity / audit |
| 007 | All B-tree, partial, GIN (full-text) and HNSW (vector) indexes |
| 008 | Functions and procedures: completion %, documentation completeness, contribution indicator, delivery risk, overdue flags |
| 009 | Views: project progress, unresolved feedback, contribution summary, faculty risk dashboard (+ three more) |
| 010 | Triggers: transition guard, audit, immutability, weightage, membership rules, version numbering, evidence generation |
| 011 / 012 | **ALTER** and **DROP** demonstrations |
| 013 | Least-privilege database role `pp_app` (password supplied from the environment) |
| 014 | Reference data: roles and the workflow transition table |

## 9.1 DDL: CREATE, constraints, ALTER, DROP

A table with column CHECKs, a table-level CHECK, composite foreign key, and the partial unique index that allows only one active project per team:

<!--include:db/migrations/003_projects_templates.sql|CREATE TABLE projects \(|^\);-->
<!--include:db/migrations/003_projects_templates.sql|One ACTIVE project per team|WHERE status NOT IN-->

**ALTER** (migration 011): a documented schema change, with a new CHECK constraint and a function that starts using the new column.

<!--include:db/migrations/011_alter_demo.sql|^ALTER TABLE milestones|^ALTER TABLE projects ALTER-->

**DROP** (migration 012): objects created while experimenting are removed safely.

<!--include:db/migrations/012_drop_demo.sql|^CREATE INDEX IF NOT EXISTS|DROP COLUMN-->

**Indexes** (migration 007): composite B-tree indexes for dashboard filters, *partial* indexes for the open-work queries, a GIN index for full-text search and an HNSW index for vector search.

<!--include:db/migrations/007_indexes.sql|CREATE INDEX idx_projects_status|idx_embeddings_filter-->

Evidence that the indexes matter (`npm run docs:explain` adds synthetic rows inside a transaction, measures the query with and without the index, then rolls everything back):

<!--explain-->

## 9.2 Views, functions and procedures

The four required views (progress, unresolved feedback, contribution summary, faculty risk dashboard) are in migration 009. As an example, the contribution summary counts **only verified** evidence and shows each member's share of the team total:

<!--include:db/migrations/009_views.sql|-- 3\. Contribution summary|pm\.evidence_points;-->

Delivery risk is calculated *inside the database* so the API, the sweep script and `psql` always agree. The function returns the score, the level, a plain-English reason and the points of each factor; the procedure stores a snapshot:

<!--include:db/migrations/008_functions.sql|-- Delivery risk: returns score|^END \$\$;-->
<!--include:db/migrations/008_functions.sql|CREATE OR REPLACE PROCEDURE sp_recalculate_risk|^END \$\$;-->

Risk formula (also shown in the application under "How is this calculated?"): overdue milestones 12.5 each (max 25) + overdue tasks 4 each (max 20) + missing mandatory deliverables 10 each (max 20) + unresolved feedback 3 each plus 2 if overdue (max 15) + inactivity 0 / 5 / 10 (max 10) + contribution imbalance up to 10. Levels: low below 25, moderate below 50, high below 75, critical from 75. A `risk_assessments` CHECK constraint refuses a level that does not match its score.

## 9.3 Triggers

Rules that must hold *whatever client writes the data* live in triggers. The generic **transition guard** reads the `status_transitions` table; the **audit** trigger records who changed which status (the API sets `app.current_user_id` per transaction); two triggers make `audit_logs` and `proposal_actions` append-only; evidence is generated automatically when a task is verified.

<!--include:db/migrations/010_triggers.sql|CREATE OR REPLACE FUNCTION fn_validate_transition|^END \$\$;-->
<!--include:db/migrations/010_triggers.sql|CREATE OR REPLACE FUNCTION fn_audit_status_change|^END \$\$;-->
<!--include:db/migrations/010_triggers.sql|CREATE OR REPLACE FUNCTION fn_block_modify_immutable|^END \$\$;-->
<!--include:db/migrations/010_triggers.sql|CREATE OR REPLACE FUNCTION fn_evidence_from_task|FOR EACH ROW EXECUTE FUNCTION fn_evidence_from_task-->

Other triggers: weightage total at most 100 (deferred constraint trigger, checked at COMMIT), team members must be students, a guide must hold the guide role and not be on the team, task and feedback assignees must be team members, automatic document version numbers, overdue-milestone risk events, and "a milestone cannot be approved while a mandatory deliverable type is missing". S-19 shows the trigger errors in `psql`.

## 9.4 Transactions: the atomic milestone submission

Submitting a milestone must never leave the database half-updated. One transaction writes the deliverable, its version, the milestone status, the review requests and an audit row; the lock in step 1 makes a double click harmless.

<!--include:src/app/api/milestones/[id]/submit/route.ts|const result = await withTransaction|^    \}\);-->

Two things live outside PostgreSQL, so they are compensated: the uploaded **file** and the **MongoDB document** (written first as `pending`). If any step fails, the transaction rolls back and the file and pending document are deleted. The automated tests (T-15) force a failure at step 3 (a negative file size violates a CHECK), and at steps 5 and 6 with a real file, and then verify that no deliverable, version, review, audit row, file or Mongo document exists and that the milestone status is unchanged. S-11 shows the message the user sees. Other transactional operations: proposal decision (status + immutable history + audit), template application (milestones + required deliverables), team creation with members, feedback actions, similarity decisions.

## 9.5 Security at the database level

- Passwords are bcrypt hashes (cost 12); the application connects as the least-privilege role `pp_app`, which cannot create tables and cannot UPDATE or DELETE `audit_logs` or `proposal_actions`:

<!--include:db/migrations/013_roles_grants.sql|^DO \$\$|^ALTER ROLE pp_app-->

- Every query uses bound parameters; the only dynamic SQL is `ORDER BY`, chosen from a fixed whitelist.
- Database-level validation (spec section 15): dates, positive numbers, allowed values, uniqueness, referential integrity, status / timestamp consistency, immutability.

# 10. NoSQL implementation (MongoDB)

**Collections** (`db/mongo/collections.ts`, created by `npm run mongo:init`, each with a `$jsonSchema` validator and indexes):

| Collection | Purpose | Key fields |
|---|---|---|
| `documents` | One document per deliverable with its versions, free-form `sections`, tags and extracted text | projectId, milestoneId, deliverableId, documentType, versions[], sections{}, tags[], state |
| `feedback_threads` | Discussion thread per feedback item | feedbackId (unique), projectId, theme, status, messages[] |
| `meeting_notes` | Guide meeting notes | projectId, date, attendees[], notes, actionItems[] |
| `attachments` | Metadata of uploaded files | projectId, deliverableId, fileName, storagePath, uploadedBy |

**Document model** (a seeded SRS; ids are PostgreSQL integers, `sections` is free-form on purpose):

<!--mongodoc-->

**Validator and indexes** for `documents` (an insert with an unknown type or an empty `versions` array is rejected with error code 121; see S-20):

<!--include:db/mongo/collections.ts|^  documents: \{|^  \},-->

**Aggregation pipelines** (`db/mongo/aggregations.ts`). A3 is a SQL + MongoDB merge: SQL knows which types are *required*, MongoDB knows which documents *exist*; the result must equal the SQL function `fn_documentation_completeness` (tested).

<!--mongo:A1-->
<!--mongo:A2-->
<!--mongo:A3-->
<!--mongo:A4-->
<!--mongo:A5-->

# 11. Vector implementation (pgvector)

| Question | Answer |
|---|---|
| **What is embedded?** | Title, abstract, problem statement, objectives and scope of each submitted proposal; long text is split into ~200-word chunks with a 30-word overlap |
| **Which model?** | `Xenova/all-MiniLM-L6-v2` (sentence-transformer), run locally through `@huggingface/transformers`: no API key, 384 dimensions, vectors normalised to length 1 |
| **How are vectors stored?** | Table `project_embeddings`: project, course, section, chunk text, `vector(384)`, model name, `is_current`, access level; unique per (project, section, chunk, model) |
| **Which metric?** | Cosine similarity. SQL operator `<=>` is cosine *distance*, so similarity = 1 − distance. Index: HNSW with `vector_cosine_ops` |
| **How is it retrieved?** | The proposal's sections are compared like-for-like (title with title, abstract with abstract ...) against current embeddings of the same course. The project score is the weighted mean of the best section similarities (title 0.15, abstract 0.30, problem 0.30, objectives 0.15, scope 0.10). A pair is flagged at **0.80** overall or when any single section reaches **0.90**; the top 5 are kept |
| **Ethical control** | Similarity is a *review signal*, never a verdict. Faculty record the decision (not similar, acceptable overlap, needs revision, escalate); the wording is "possible overlap". Students only receive a generic yes / no hint and never see another team's text, titles or scores |

Retrieval query (the metadata filter and the vector search happen in one statement):

<!--include:src/lib/embeddings/service.ts|const \{ rows \} = await c.query\(|LIMIT 30-->

Scoring (pure functions, unit-tested):

<!--include:src/lib/embeddings/scoring.ts|^export const SECTION_WEIGHTS|^export function isFlagged-->

**Result on the demo data.** Echo's proposal (*CollegeEvents Hub*) is a close paraphrase of Alpha's (*CampusConnect*): it is flagged at the review threshold, with the matching text shown to faculty. The unrelated proposals score far below it, and Foxtrot (*FestFlow*, a similar topic in a **different course**) can never appear because of the course filter.

<!--vector-->

The seeded wording was calibrated against the *real* model scores (a looser paraphrase scored 0.69, below the threshold), not adjusted to fake a number; the threshold is configurable (`SIMILARITY_THRESHOLD`). Faculty screen: S-15. Student hint and decision workflow: tests T-22 and T-23.

# 12. Important queries

All queries are in `db/queries/important_queries.sql`, use bound parameters, and are executed by an automated test against the demo data. Each shows the concept it demonstrates and its real output.

### Q1. High-risk projects of a guide (view, JOIN, ORDER BY)
<!--query:Q1-->
### Q2. Teams with more than N overdue tasks (JOIN, GROUP BY, HAVING, date arithmetic)
<!--query:Q2-->
### Q3. Contribution comparison inside a team (LEFT JOIN, conditional aggregation)
<!--query:Q3-->
### Q4a. Milestones that still have unresolved feedback (JOIN, GROUP BY)
<!--query:Q4a-->
### Q4b. Approved milestones with no unresolved feedback (correlated subquery, NOT EXISTS)
<!--query:Q4b-->
### Q5. Projects lacking mandatory deliverable types (anti-join, GROUP BY, HAVING)
<!--query:Q5-->
### Q6. Similar proposals (pgvector cosine distance with a metadata filter)
<!--query:Q6-->
### Q7. Latest risk per project (DISTINCT ON)
<!--query:Q7-->
### Q8. Risk trend of one project (GROUP BY a derived date)
<!--query:Q8-->
### Q9. Guide workload (JOIN, GROUP BY, FILTER aggregate)
<!--query:Q9-->
### Q10. Unapproved milestones past due, by course
<!--query:Q10-->
### Q11. Students with more open feedback than average (subquery in HAVING)
<!--query:Q11-->
### Q12. Full-text search over proposals (GIN index)
<!--query:Q12-->
### Q13. Feedback turnaround time per guide
<!--query:Q13-->
### Q14. Projects whose risk is worse than a week ago (self-join on snapshots)
<!--query:Q14-->

**DML coverage.** INSERT, UPDATE, DELETE and SELECT are exercised by the application (create proposal / task / deliverable / feedback; controlled status updates; deleting a draft deliverable or a task assignment, both audited) and by negative tests: an INSERT that violates a foreign key, an UPDATE with an illegal transition, a DELETE blocked by `ON DELETE RESTRICT`.

# 13. System architecture and security design

```mermaid
flowchart LR
  B["Browser<br/>Next.js pages, role-based UI"] -->|"HTTP + HttpOnly JWT cookie"| M["Middleware<br/>session gate"]
  M --> R["Route Handlers /api/*<br/>role + ownership checks<br/>Zod validation"]
  R -->|"parameterised SQL"| PG[("PostgreSQL<br/>tables, views, triggers,<br/>functions, pgvector")]
  R -->|"documents, threads"| MG[("MongoDB<br/>documents, feedback_threads,<br/>meeting_notes, attachments")]
  R --> E["Embedding model<br/>MiniLM-L6-v2, in process"]
  E -->|"384-d vectors"| PG
  R --> F[("Local file storage<br/>storage/uploads, never public")]
  PG -. "triggers: audit, workflow,<br/>evidence, overdue flags" .-> PG
```

**Layers.** The browser talks only to Next.js. Middleware blocks anonymous users; every Route Handler then authenticates, authorises by **role and ownership loaded from the database** (never from the browser), validates input with Zod, runs parameterised SQL (in a transaction when it writes more than once) and returns consistent JSON errors with friendly messages (database error codes are mapped, raw SQL errors never leak). Integrity rules that must hold for any client (CHECKs, foreign keys, triggers) live in the database; orchestration that needs the current user, files or two databases lives in the handlers.

| Concern | Design |
|---|---|
| Passwords | bcrypt (cost 12), salted, never logged or returned; minimum 8 characters with a letter and a digit |
| Sessions | JWT (HS256) in an `HttpOnly`, `SameSite=Lax` cookie, 8-hour expiry; account status and roles re-read from the database on every request, so a suspended user is locked out immediately |
| Authorisation | Role plus relationship (team member, allocated guide / reviewer, admin) on every route; a non-participant gets 404 so the existence of other teams' projects is not revealed |
| Brute force | Five failures lock the account for 15 minutes; one generic message for unknown users and wrong passwords |
| Injection | Parameterised SQL only; dynamic `ORDER BY` from a whitelist; React escapes output; CSV cells that start with `= + - @` are neutralised |
| CSRF | SameSite cookies plus an `Origin` check on state-changing requests |
| Uploads | Extension allow-list, size limit, content check (magic bytes), random storage names outside `public/`, SHA-256 checksum, served only through an authorised route with `attachment` and `nosniff` |
| Secrets | Only in `.env` (git-ignored); `.env.example` holds placeholders; a test scans the repository for leaked values |
| Database | Least-privilege role `pp_app`; append-only audit and proposal history; every status change audited with the acting user |
| Headers | `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` |

# 14. Application screenshots

All screenshots are of the running application with the seeded demo data, taken by `npm run docs:screenshots` (real sessions through the login API, no hand editing). The six demo teams show different situations: **Alpha** healthy, **Bravo** delayed (high risk), **Charlie** unequal contribution, **Delta** unresolved feedback and a missing test report, **Echo** a near-duplicate of Alpha awaiting similarity review, **Foxtrot** another course.

<figure><img src="screenshots/S-01-login.png"><div class="caption">S-01 Login</div></figure>
<figure><img src="screenshots/S-02-student-dashboard.png"><div class="caption">S-02 Student dashboard: team progress, deadlines, my tasks, feedback, contribution, risk</div></figure>
<figure><img src="screenshots/S-03-guide-dashboard.png"><div class="caption">S-03 Faculty dashboard: risk cards, high-risk projects, approval queue, unresolved feedback, delayed teams</div></figure>
<figure><img src="screenshots/S-04-admin-dashboard.png"><div class="caption">S-04 Admin console: system totals and risk by course</div></figure>
<figure><img src="screenshots/S-05-proposal-form.png"><div class="caption">S-05 Proposal form (revision requested) with "Check originality"</div></figure>
<figure><img src="screenshots/S-06-proposal-approval-history.png"><div class="caption">S-06 Proposal decision panel and immutable history</div></figure>
<figure><img src="screenshots/S-07-guide-allocation.png"><div class="caption">S-07 Guide and reviewer allocation (admin)</div></figure>
<figure><img src="screenshots/S-07b-team.png"><div class="caption">S-07b Team members and responsibilities</div></figure>
<figure><img src="screenshots/S-08-milestone-timeline.png"><div class="caption">S-08 Milestone timeline, progress and mandatory deliverables</div></figure>
<figure><img src="screenshots/S-09-task-kanban.png"><div class="caption">S-09 Task Kanban board (todo, in progress, blocked, done, verified) with filters</div></figure>
<figure><img src="screenshots/S-10-deliverables-versions.png"><div class="caption">S-10 Deliverables with version history and the submission panel</div></figure>
<figure><img src="screenshots/S-11-submission-rollback.png"><div class="caption">S-11 A failed submission: the user is told nothing was saved</div></figure>
<figure><img src="screenshots/S-12-feedback-thread.png"><div class="caption">S-12 Feedback workflow with the MongoDB discussion thread</div></figure>
<figure><img src="screenshots/S-13-contribution.png"><div class="caption">S-13 Contribution view (Charlie): one member carries most of the verified evidence</div></figure>
<figure><img src="screenshots/S-14-risk-detail.png"><div class="caption">S-14 Risk detail: score, factor breakdown, trend, events</div></figure>
<figure><img src="screenshots/S-15-similarity-review.png"><div class="caption">S-15 Similarity review: score, per-section similarity, decision form</div></figure>
<figure><img src="screenshots/S-16-reports.png"><div class="caption">S-16 Reports with filters (delayed teams)</div></figure>
<figure><img src="screenshots/S-16b-reports-high-risk.png"><div class="caption">S-16b Reports: high-risk projects with the risk level filter</div></figure>
<figure><img src="screenshots/S-17-audit-log.png"><div class="caption">S-17 Audit log with filters</div></figure>
<figure><img src="screenshots/S-18-migrations-progress.png"><div class="caption">S-18 Migrations with a progress bar</div></figure>
<figure><img src="screenshots/S-18b-seed-progress.png"><div class="caption">S-18b Seeding with progress bars (PostgreSQL, MongoDB, embeddings)</div></figure>
<figure><img src="screenshots/S-19-sql-features.png"><div class="caption">S-19 psql: function, view, and trigger errors</div></figure>
<figure><img src="screenshots/S-20-mongo-aggregation.png"><div class="caption">S-20 MongoDB aggregations and validator rejection</div></figure>
<figure><img src="screenshots/S-21-test-results.png"><div class="caption">S-21 Automated test results</div></figure>
<figure><img src="screenshots/S-22-git-history.png"><div class="caption">S-22 Repository history</div></figure>
<figure><img src="screenshots/S-23-admin-users.png"><div class="caption">S-23 Administration: users and roles</div></figure>
<figure><img src="screenshots/S-24-admin-templates.png"><div class="caption">S-24 Administration: project templates</div></figure>
<figure><img src="screenshots/S-25-insights.png"><div class="caption">S-25 Document insights computed in MongoDB</div></figure>

# 15. Testing results

{{testsPassed}} of {{tests}} automated tests pass: database tests run inside rolled-back transactions; API tests call the running application over HTTP; unit tests cover scoring, chunking, CSV safety and the repository secret scan. The tests that change data (workflow, uploads, rollback, similarity decisions, peer evaluation, administration) restore the demo automatically afterwards. Every case T-01 to T-30 of the specification has automated evidence below.

<!--testresults-->

# 16. Conclusion and future enhancements

**Conclusion.** ProjectPulse turns scattered project supervision into an evidence-based, explainable workflow. Delays, unequal contribution, missing documentation, unresolved feedback and overlapping proposals become visible early, with the reason attached, while faculty keep every decision about grades and originality. The three database paradigms each do what they are best at: PostgreSQL guarantees the workflow and integrity (constraints, triggers, transactions, views, functions), MongoDB holds flexible documents and discussions, and pgvector finds proposals that mean the same thing. All of it is exercised by a working Next.js application and by {{tests}} automated tests.

**Known limitations.** Notifications, rate limiting and a strict Content-Security-Policy were optional and are not built. Only proposal sections are embedded (not the text of uploaded documents). Risk is a transparent rule-based score, not a predictive model. Commit references are entered by hand.

**Future enhancements.** GitHub OAuth sync of commits and pull requests; OCR and PDF text extraction with per-section document embeddings; e-mail / WhatsApp notifications; machine-learning risk prediction; assisted similarity reports with source highlighting (still human-decided); LMS / ERP integration; PostgreSQL row-level security; analytics across semesters; a mobile-friendly PWA.

# 17. Team contributions and repository

The team has two members, **Chiranthan** and **Aadish**. As agreed in the proposal, the database work (ER diagram, relational schema, DDL, constraints, indexes, views, triggers, functions, queries, test data) and the application work (Next.js interface, authentication and authorisation, MongoDB model, semantic-search module, dashboards, testing) are split between the members, and each also contributes to the other half. The **repository history is the record of individual contributions** (S-22):

<!--git-->

The GitHub repository link is submitted together with this report. The README explains setup and execution step by step; every design decision and every deviation from the specification is recorded in `docs/DECISIONS.md`.

# 18. References

1. Next.js documentation, App Router and Route Handlers. https://nextjs.org/docs
2. PostgreSQL 16+ documentation: constraints, triggers, transactions, full-text search. https://www.postgresql.org/docs/
3. pgvector: open-source vector similarity search for PostgreSQL (HNSW, cosine distance). https://github.com/pgvector/pgvector
4. MongoDB manual: `$jsonSchema` validation and the aggregation framework. https://www.mongodb.com/docs/manual/
5. Reimers and Gurevych, *Sentence-BERT: Sentence Embeddings using Siamese BERT-Networks*, 2019; model `sentence-transformers/all-MiniLM-L6-v2`, ONNX port `Xenova/all-MiniLM-L6-v2`. https://huggingface.co/Xenova/all-MiniLM-L6-v2
6. Transformers.js (`@huggingface/transformers`). https://huggingface.co/docs/transformers.js
7. OWASP Cheat Sheets: Password Storage, SQL Injection Prevention, CSRF Prevention, CSV Injection.
8. Mermaid (diagrams) and `marked` (Markdown) used to build this report.

# Appendix A: complete data dictionary

<!--file:docs/data_dictionary.md-->

# Appendix B: how to run the project

```bash
cp .env.example .env            # fill in real values locally (never commit .env)
npm install
npm run db:migrate              # applies db/migrations/*.sql with a progress bar
npm run db:seed                 # demo data in PostgreSQL + MongoDB + embeddings (first run downloads the model)
npm run dev                     # http://localhost:3000
npm test                        # database + unit tests (API tests run when the app is up)
ALLOW_MUTATING_TESTS=1 npm test # also the workflow tests; the demo is restored afterwards
npm run risk:sweep              # store a fresh risk snapshot for every running project
npm run docs:report             # rebuild report.pdf from docs/REPORT.md
```

Demo accounts (password = `SEED_DEFAULT_PASSWORD` in your `.env`): `admin@projectpulse.test`, `guide1@` to `guide3@`, `reviewer1@`, `reviewer2@`, `student01@` to `student14@projectpulse.test`.
