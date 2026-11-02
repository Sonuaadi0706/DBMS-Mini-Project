# ProjectPulse — Complete Build Specification

**Academic Project Governance, Originality and Milestone Risk Monitor**
DBMS Experiential Learning – Level 3 Project

> This file is the single source of truth for building the project from scratch. It was reconstructed from three surviving documents (the instructor guidelines, the project proposal `project.md`, and the draft relational-schema diagram) after the original planning chat was lost. It is written to be handed directly to Claude Code.

---

## 0. How to use this file (instructions for Claude Code)

1. **Read the whole file before writing any code.** Then create a `CLAUDE.md` at the repo root that summarises sections 0, 6 and 20 so the rules persist across sessions.
2. **Ground-truth priority.** Where two sources disagree, use this order: (1) instructor guidelines (Section 3), (2) the project proposal content (Sections 2, 4, 5, 7-17 marked `[PROPOSAL]`), (3) everything else. The old schema diagram (Appendix A) is **superseded**: it was thinner than the proposal. The schema in Section 8 replaces it.
3. **Tag legend** used throughout:
   - `[GUIDELINE]` — mandated by the instructor's guidelines.
   - `[PROPOSAL]` — stated in the approved proposal (`project.md`). Do not drop or contradict it.
   - `[ASSUMED]` — nothing was decided in the lost chat, so a sensible default was chosen. Safe to change, but note any change in `docs/DECISIONS.md`.
   - `[ADDED]` — an extra feature or safeguard that improves the project. Each has a priority: **P0** must build, **P1** should build, **P2** only if time remains.
4. **Build in vertical slices**, not layer by layer: get one feature working end to end (DB → API → UI → test), commit, then move on. Follow the day plan in Section 20.
5. **Never hard-code secrets.** All credentials come from environment variables. Commit `.env.example` only, never `.env`. `[GUIDELINE]`
6. **Raw SQL, parameterised queries only.** Never build SQL by string concatenation. All DB logic that the course wants to see (constraints, views, functions, triggers, transactions) must live in versioned `.sql` migration files, not hidden inside an ORM.
7. **Progress indicators.** Every script that can take more than a couple of seconds (migration runner, seed script, embedding backfill, risk sweep, report export) must show a progress bar or step counter in the terminal (use the `cli-progress` npm package). Long UI actions need a spinner or progress bar too.
8. **Plain-language comments** in SQL and code explaining *why* a constraint or trigger exists. The team will need to explain every part in a viva.
9. **Ask before expanding scope.** If something here is ambiguous, pick the simplest option that satisfies the guidelines, record it in `docs/DECISIONS.md`, and continue.
10. **After every slice** run the migrations from scratch on an empty database (`npm run db:reset`) to prove they are repeatable.

---

## 1. Situation and deliverables

| Item | Detail |
|---|---|
| Course | DBMS Experiential Learning – Level 3 Project (instructor: Dr. Nagasundari S) |
| Team | 2 members: **Chiranthan** and **Aadish** (most hands-on development will be done by Aadish) |
| Deadline | **About one week from now** (exact date not recorded; treat the next 7 days as the hard limit) |
| Final submission | (1) **GitHub repository link**, (2) **`report.pdf`** |
| Status | Planning only. No repository, no code, no database exists yet. Only the proposal and a draft ER diagram survive. |
| Title approval | The instructor has approved the title **"ProjectPulse: Academic Project Governance, Originality and Milestone Risk Monitor"**. |
| Extra instructions | None beyond the guidelines. |
| Demo | A final demonstration will be evaluated (Section 19). |

**Why the deadline matters for this spec:** the scope is large. Section 5 and Section 20 split work into P0/P1/P2 so a working, demo-ready P0 version exists by day 5 even if P2 features are cut.

---

## 2. Project overview `[PROPOSAL]`

### 2.1 Title and submission fields

| Field | Content |
|---|---|
| Project title | ProjectPulse: Academic Project Governance, Originality and Milestone Risk Monitor |
| Domain | Education Technology / Academic Project Management |
| Team size | Two members |
| Technology stack | Next.js; Next.js Route Handlers; PostgreSQL; MongoDB; PostgreSQL with pgvector; Git/GitHub |
| Project level | Medium–Hard; database-intensive; beyond basic CRUD |

Title-uniqueness note from the proposal: the title must be unique in the section. It is already approved by the instructor, so no variant (e.g. "MilestoneIQ", "TeamTrace") is needed.

### 2.2 Final problem statement

In colleges, student teams working on mini-projects, capstones, dissertations, and research assignments often face late or missed milestones, unclear task ownership, unequal individual contribution, incomplete documentation, unresolved faculty feedback, and project proposals that substantially overlap with other teams. Faculty guides commonly discover these issues only near final submission, when there is limited time to intervene, correct the scope, recover missed work, or assess individual participation fairly.

ProjectPulse is a web-based academic project-governance platform that will enable students, faculty guides, reviewers, and administrators to manage the complete project lifecycle: project proposal, team formation, guide allocation, milestone planning, task allocation, evidence submission, document-version tracking, feedback resolution, approval workflows, contribution evidence, and project delivery-risk monitoring. The system will also use semantic similarity search to flag potentially similar project titles, abstracts, objectives, and problem statements for faculty review.

The platform will provide explainable progress, contribution, and risk indicators based on recorded evidence such as verified task completion, document uploads, feedback resolution, milestone status, deadlines, and optional GitHub activity references. It will support faculty judgment rather than making automatic grading or plagiarism decisions. The objective is to ensure early intervention, better documentation quality, transparent team accountability, and original project design.

### 2.3 Concise problem statement (for the report and README)

Educational institutions often discover delayed milestones, unequal team contribution, incomplete documentation, unresolved faculty feedback, and substantially overlapping project proposals only near final evaluation. ProjectPulse will provide a Next.js-based academic project-governance platform using PostgreSQL, MongoDB, and pgvector to manage project proposals, teams, milestones, tasks, document evidence, feedback workflows, contribution indicators, delivery-risk alerts, and semantic similarity screening. The system will support timely faculty intervention and fair, transparent project monitoring while retaining human judgment for evaluation and originality decisions.

### 2.4 Real-world need and motivation

- Faculty may supervise many teams simultaneously and need a single dashboard to identify delayed or high-risk projects early.
- Final reports alone do not provide reliable evidence of individual contributions, iterative work, feedback resolution, or document evolution.
- Project teams need a structured and transparent way to plan work, divide responsibilities, submit evidence, and respond to guide feedback.
- Institutions need an early review mechanism to identify substantially overlapping project ideas before teams spend time building similar systems.
- The solution improves governance and fairness while maintaining human oversight for academic integrity and assessment decisions.

### 2.5 Objectives

1. Create a structured workflow from project proposal approval to final evaluation.
2. Track project teams, faculty guides, milestones, tasks, deadlines, deliverables, document versions, reviews, and feedback.
3. Maintain evidence-based contribution records for each team member.
4. Calculate explainable delivery-risk levels based on overdue work, missing evidence, unresolved feedback, inactivity, and contribution imbalance.
5. Provide role-based dashboards for Students, Faculty Guides, Reviewers, and Administrators.
6. Use semantic similarity search to retrieve and flag conceptually similar proposals for faculty review.
7. Demonstrate practical SQL, NoSQL, vector-database, and advanced DBMS concepts through a functional Next.js application.

### 2.6 Scope

**Included in the first version:** proposal approval, role-based access, team and guide allocation, milestone and task tracking, deliverable submission and version metadata, faculty feedback workflow, contribution evidence, risk analytics, dashboards, document storage, and semantic proposal-similarity screening.

**Out of scope / future enhancement:** automated plagiarism verdicts, automated final grading, mandatory GitHub OAuth sync, OCR of scanned documents, WhatsApp/email delivery, and machine-learning predictive models. GitHub URLs and activity references are recorded manually in the first version.

### 2.7 Originality justification

ProjectPulse is not a generic task manager or simple CRUD project. Its original focus is the integration of academic-project governance with evidence-based contribution monitoring, workflow-aware milestone risk analysis, document version management, faculty feedback resolution, auditable approvals, and semantic similarity screening. Each database is chosen for a specific data need: PostgreSQL for relational integrity and workflow transactions, MongoDB for flexible document records, and pgvector for meaning-based comparison of text-heavy project content.

---

## 3. Instructor guidelines → how this project satisfies each point `[GUIDELINE]`

The guidelines come from "DBMS Level 3 Project" (Dr. Nagasundari S). Every point below must be demonstrable.

| # | Guideline requirement | How ProjectPulse satisfies it | Where in this spec |
|---|---|---|---|
| 1 | Unique title in section; real-world problem; **not simple CRUD** | Approved title; governance + risk scoring + similarity + workflows | §2, §9, §10 |
| 2 | Teams of 2; clearly defined responsibilities; **both contribute to database and application work** | Responsibility split with cross-contribution requirement | §18 |
| 3 | Use SQL (MySQL/PostgreSQL), NoSQL (MongoDB/Neo4j…), vector DB (pgvector…); minimum **two paradigms** | PostgreSQL + MongoDB + pgvector = three paradigms | §7 |
| 4 | ER diagram → relational schema; identify entities, attributes, PKs, FKs, relationships, constraints; for NoSQL/vector document data model, collections, indexes, embeddings, metadata, retrieval strategy | Section 8 (SQL), Section 11 (Mongo), Section 12 (vector); ER diagram generated into `docs/` | §8, §11, §12 |
| 5 | DDL: CREATE, ALTER, DROP, PK/FK, constraints, indexes, views | Migration files 001–014 | §8, §9 |
| 6 | DML: INSERT, UPDATE, DELETE, SELECT; JOIN, GROUP BY, HAVING, ORDER BY, aggregates, subqueries | Query catalogue Q1–Q14 and API operations | §10, §13 |
| 7 | **At least four** advanced concepts (transactions, views, stored procedures/functions, triggers, indexing, full-text search, NoSQL aggregation, vector similarity search) | This project demonstrates **eight** (+ full-text search as an extra) | §9, §11, §12 |
| 8 | Vector DB/semantic search (optional but recommended): what is embedded, which model, how stored, which metric, how retrieved | Fully specified | §12 |
| 9 | Functional **Next.js** web interface: forms, tables, search, filtering, dashboards | Pages list | §14 |
| 10 | Next.js talks to DB through backend/API layer; **no hard-coded credentials**; env variables | Route Handlers; `.env` | §6, §13 |
| 11 | Authentication; role-based access; **minimum 2 roles** | 4 roles | §4, §16 |
| 12 | Input validation **at the database level**; consistency and integrity | CHECK, FK, UNIQUE, triggers | §8, §9 |
| 13 | Basic DB and web security; **passwords/credentials never in plain text** | bcrypt hashes; env secrets | §16 |
| 14 | Documentation: problem statement, objectives, scope, functional requirements, ER diagram, relational schema, database choice and justification, data dictionary, SQL/NoSQL/vector implementation, important queries, system architecture, application screenshots, testing results, conclusion and future enhancements | Report outline | §21 |
| 15 | Git/GitHub; commits show **individual** contributions; README with setup and execution instructions | Git workflow + README checklist | §22 |
| 16 | Final demo: problem and motivation; ER and design; relational schema; DB implementation; important queries; Next.js interface; DB integration; advanced features; test cases; individual contribution | Demo script | §19 |
| 17 | Originality; no copying a project/tutorial/repo | Original design; see §2.7 | §2.7 |
| 18 | Level 3 expectation: beyond CRUD; clear link between DB concepts, design, implementation, UI; DB choice must be **justified by the nature of the data** | §7 justification table | §7 |

Instructor's closing rule (quote of intent): database technology must be chosen based on problem requirements, and the team must justify why SQL, NoSQL or vector is appropriate for each type of data. **Suggested minimum stack:** Next.js frontend; Next.js API routes/Route Handlers backend; SQL/NoSQL/vector database; Git + GitHub.

---

## 4. Roles and authorization `[PROPOSAL]`

A user may hold **multiple roles** (`user_roles` many-to-many). The UI shows a role switcher if a user has more than one.

| Role | Access and responsibilities |
|---|---|
| **Student** | Create/update their project proposal, view team milestones/tasks, upload evidence, submit deliverables, resolve assigned feedback, and view their **own** contribution record. |
| **Faculty Guide** | Review proposals and submissions, create feedback, approve/reject milestones, verify evidence, and monitor assigned project dashboards. |
| **Reviewer** | Review allocated milestone/final submissions and record comments or rubric results. |
| **Admin / Coordinator** | Manage users, courses, departments, project templates, guide allocations, role assignments, and system-wide reports. |

### 4.1 Permission matrix `[ASSUMED]` (refines the table above)

Legend: **R** read, **C** create, **U** update, **D** delete, **A** approve/decide, **—** no access, "own" = only records belonging to the user's own team/assignment.

| Resource | Student | Faculty Guide | Reviewer | Admin |
|---|---|---|---|---|
| Users, roles | own profile R/U | own profile R/U | own profile R/U | CRUD all |
| Departments, courses, templates | R | R | R | CRUD |
| Teams, team members | own team R; leader can C/U members | assigned teams R | assigned teams R | CRUD |
| Guide/reviewer allocations | own R | assigned R | assigned R | CRUD |
| Project proposal | own CRU (before approval) | assigned R + A | assigned R | R all, force-archive |
| Milestones | own team R, C/U draft plan | assigned R, A (approve/reject) | assigned R | R all |
| Tasks, assignments | own team CRU; D draft | assigned R; verify | assigned R | R all |
| Deliverables, versions | own team C/R | assigned R, accept/reject | assigned R | R all |
| Reviews, rubric scores | own team R | C/R | C/R (own) | R all |
| Feedback items | assigned-to-me R/U (respond, resolve) | C/R/U, verify, reopen | C/R | R all |
| Contribution evidence | own R | assigned R, verify | R | R all |
| Peer evaluations | C (own teammates), R own received (anonymised) | R assigned | — | R all |
| Risk assessments | own team: level + reasons R | assigned R, recalculate | assigned R | R all, run sweep |
| Similarity review | pre-submission hint only (no other team's data) | R, decide | R | R all |
| Audit logs | — | assigned-project R | — | R all |

**Hard rules:** (a) a student can never read another team's private documents, feedback or evidence; (b) a faculty guide/reviewer can never be a member of the team they review; (c) peer evaluations shown to a student are aggregated/anonymised; (d) every API route checks **role and ownership**, not just login.

---

## 5. Functional requirements

Priority: **P0** must have for demo, **P1** should have, **P2** nice to have.

### 5.1 Authentication and roles `[PROPOSAL]`
| ID | Requirement | Pri | Source |
|---|---|---|---|
| AUTH-01 | Login with email + password; passwords stored only as salted hashes | P0 | PROPOSAL |
| AUTH-02 | Enforce role-based access for Student, Faculty Guide, Reviewer, Admin in API routes and UI | P0 | PROPOSAL |
| AUTH-03 | Users can hold multiple roles; role switcher in the UI | P1 | PROPOSAL |
| AUTH-04 | Secure session (JWT in HttpOnly cookie), logout, session expiry | P0 | PROPOSAL |
| AUTH-05 | Account lockout after 5 failed attempts for 15 minutes | P1 | ADDED |
| AUTH-06 | Change password; admin can deactivate/suspend a user | P1 | ADDED |

### 5.2 Project proposal and approval `[PROPOSAL]`
| ID | Requirement | Pri |
|---|---|---|
| PROP-01 | Students create proposals with title, abstract, problem statement, objectives, scope, domain, technologies, repository link | P0 |
| PROP-02 | Save as draft; edit until submitted or while revision requested | P0 |
| PROP-03 | Submit for faculty review (status → `submitted`) | P0 |
| PROP-04 | Faculty can **approve, reject, or request revision**, with comments | P0 |
| PROP-05 | **Immutable action history** of every proposal decision (no UPDATE/DELETE allowed) | P0 |
| PROP-06 | Resubmission after a revision request keeps full history | P1 |
| PROP-07 | Pre-submission similarity hint for students ("this may overlap with an existing proposal; faculty will review") without revealing other teams' content | P1 ADDED |

### 5.3 Team management `[PROPOSAL]`
| ID | Requirement | Pri |
|---|---|---|
| TEAM-01 | Create teams for a course; add members; map role/responsibility to each member; one team leader | P0 |
| TEAM-02 | A student can belong to only one team per course/semester (DB-enforced) | P0 |
| TEAM-03 | Admin allocates faculty guide and reviewer(s) to a project; one guide per project | P0 |
| TEAM-04 | Guide/reviewer cannot be a member of the same team | P1 ADDED |

### 5.4 Milestones and tasks `[PROPOSAL]`
| ID | Requirement | Pri |
|---|---|---|
| MS-01 | Create dated milestones with title, due date, weightage; total weightage per project ≤ 100 | P0 |
| MS-02 | Create milestones from an admin-defined **project template** | P1 |
| MS-03 | Create granular tasks under a milestone | P0 |
| MS-04 | Assign **owners and collaborators** to tasks (many-to-many) | P0 |
| MS-05 | Capture **planned and actual** completion details on tasks | P0 |
| MS-06 | Controlled task workflow: todo → in_progress → done → verified (guide verifies) | P0 |
| MS-07 | Guide approves/rejects milestones | P0 |
| MS-08 | Kanban-style task board and timeline view of milestones | P1 |

### 5.5 Deliverables `[PROPOSAL]`
| ID | Requirement | Pri |
|---|---|---|
| DEL-01 | Upload files **or** register evidence links, source-repository links, screenshots | P0 |
| DEL-02 | Version/change summary for each document; version numbers auto-increment | P0 |
| DEL-03 | Structured metadata in PostgreSQL; flexible document record (sections, tags, extracted text) in MongoDB | P0 |
| DEL-04 | **Atomic milestone submission** (see §9.5) | P0 |
| DEL-05 | Mandatory deliverable types per milestone; detect missing ones | P0 |

### 5.6 Review and feedback `[PROPOSAL]`
| ID | Requirement | Pri |
|---|---|---|
| FB-01 | Guide/reviewer creates a review for a milestone with comments and rubric scores | P0 |
| FB-02 | Create **feedback items**, assign each to a student | P0 |
| FB-03 | Student responds and marks resolved; guide **verifies** or reopens | P0 |
| FB-04 | Discussion thread per feedback item (stored in MongoDB) | P1 |

### 5.7 Contribution tracking `[PROPOSAL]`
| ID | Requirement | Pri |
|---|---|---|
| CON-01 | Evidence records auto-created from verified tasks, document actions, feedback resolution | P0 |
| CON-02 | Optional Git evidence entered manually (repo URL, commit reference) | P1 |
| CON-03 | Peer evaluation of teammates (controlled, one per pair per period) | P1 |
| CON-04 | Contribution summary per member; students see only their own | P0 |
| CON-05 | Guide verifies evidence; only verified evidence counts | P0 |

### 5.8 Risk monitoring `[PROPOSAL]`
| ID | Requirement | Pri |
|---|---|---|
| RISK-01 | Calculate **low / moderate / high / critical** delivery risk with clear reasons | P0 |
| RISK-02 | Store historical risk assessments (trend) | P0 |
| RISK-03 | Triggers flag/create risk events when milestones become overdue | P0 |
| RISK-04 | Risk sweep job callable by Admin (button) and by script; no external cron needed | P1 ADDED |

### 5.9 Similarity review `[PROPOSAL]`
| ID | Requirement | Pri |
|---|---|---|
| SIM-01 | Embed title, abstract, problem statement, objectives, scope on submission/approval | P0 |
| SIM-02 | Search/compare embeddings; filter by course/semester and permissions; top-k above a review threshold | P0 |
| SIM-03 | Show matching text and score to faculty | P0 |
| SIM-04 | Faculty saves a decision and comments; **no automatic plagiarism verdict** | P0 |
| SIM-05 | Free-text semantic search box for faculty | P2 ADDED |

### 5.10 Dashboards and reports `[PROPOSAL]`
| ID | Requirement | Pri |
|---|---|---|
| DASH-01 | Dashboards and filters for **delayed teams, unapproved milestones, unresolved feedback, contribution imbalance, high-risk projects** | P0 |
| DASH-02 | Role-based dashboards (student, guide, reviewer, admin) | P0 |
| DASH-03 | Progress bars, risk cards, timeline views, approval queues | P0 |
| RPT-01 | CSV export of dashboard tables | P2 ADDED |
| ADM-01 | Admin manages users, courses, departments, project templates, guide allocations, role assignments, system-wide reports | P0 |
| AUD-01 | Admin audit-log viewer with filters | P1 ADDED |
| NOT-01 | In-app notifications (feedback assigned, milestone approved, risk escalated); **no email/WhatsApp** (out of scope) | P2 ADDED |

---

## 6. Architecture, tech stack and project setup

### 6.1 Stack `[PROPOSAL]` + choices `[ASSUMED]`

| Layer | Choice | Notes |
|---|---|---|
| Frontend | **Next.js** (App Router) `[PROPOSAL]` | TypeScript `[ASSUMED]`, Tailwind CSS `[ASSUMED]` |
| Backend/API | **Next.js Route Handlers** (`app/api/**/route.ts`) `[PROPOSAL]` | Zod for request validation `[ASSUMED]` |
| SQL DB | **PostgreSQL 16** `[PROPOSAL]` | Accessed with the `pg` library and raw SQL `[ASSUMED]`; no ORM |
| NoSQL DB | **MongoDB 7** `[PROPOSAL]` | Official `mongodb` Node driver with `$jsonSchema` validators `[ASSUMED]` |
| Vector DB | **PostgreSQL + pgvector** `[PROPOSAL]` | Same Postgres server, `vector(384)` column, HNSW index |
| Embeddings | `Xenova/all-MiniLM-L6-v2` via `@huggingface/transformers` (runs locally in Node, 384 dimensions, normalised) `[ASSUMED]` | No API key needed. Fallback: small Python `sentence-transformers` service exposing `POST /embed`. |
| Auth | Custom: `bcryptjs` (cost 12) + `jose` JWT in HttpOnly cookie `[ASSUMED]` | Passwords only as salted hashes `[PROPOSAL]` |
| Files | Local folder `storage/uploads/` outside `public/`, served only through an authorised route `[ASSUMED]` | Config via `STORAGE_*` env vars `[PROPOSAL]` |
| Dev infra | Docker Compose for Postgres (`pgvector/pgvector:pg16`) and MongoDB `[ASSUMED]` | Local run for demo; no deployment required |
| Tests | Vitest (SQL + API integration), Playwright optional (P2) `[ASSUMED]` | |
| Tooling | `cli-progress` (progress bars), `tsx` (run TS scripts), `dotenv` | |
| VCS | Git + GitHub `[GUIDELINE]` | |

### 6.2 System architecture (describe in report with a diagram)

```
Browser (Next.js pages/components, role-based UI)
        │  HTTPS (local http for demo)
        ▼
Next.js Route Handlers  ── auth middleware (JWT) ── role + ownership checks ── Zod validation
        │               │                 │
        ▼               ▼                 ▼
  PostgreSQL        MongoDB          Embedding service (in-process)
  (relational +     (documents,      → vectors stored in PostgreSQL
   pgvector)         threads, notes)    (project_embeddings, pgvector)
        ▲
        └── SQL functions/triggers/views do risk, audit, integrity inside the DB
Local file storage (uploads) ← referenced by document metadata
```

### 6.3 Repository layout `[ASSUMED]`

```
projectpulse/
├─ CLAUDE.md                      # rules summary (create from §0, §6, §20)
├─ README.md                      # setup + run + demo accounts (see §22)
├─ docker-compose.yml
├─ .env.example                   # committed; .env is git-ignored
├─ .gitignore
├─ package.json
├─ db/
│  ├─ migrations/                 # 001_…sql … 014_…sql  (version-controlled DDL)
│  ├─ seeds/                      # seed scripts (TypeScript) + reference data
│  ├─ queries/                    # important_queries.sql (Q1–Q14, runnable)
│  ├─ mongo/                      # collections.js (validators, indexes), aggregations.js
│  └─ tests/                      # SQL-level tests (constraints, triggers, rollback)
├─ scripts/                       # migrate.ts, seed.ts, reset.ts, embed-backfill.ts, risk-sweep.ts
├─ src/
│  ├─ app/                        # Next.js pages
│  │  ├─ (auth)/login
│  │  ├─ (app)/dashboard, proposals, teams, projects/[id]/…, feedback, similarity, admin/…
│  │  └─ api/…                    # Route Handlers (see §13)
│  ├─ components/                 # UI components (tables, boards, risk cards, progress bars)
│  ├─ lib/
│  │  ├─ db/pg.ts                 # pg Pool, withTransaction helper
│  │  ├─ db/mongo.ts              # Mongo client singleton
│  │  ├─ auth/                    # session, hashing, requireRole(), requireProjectAccess()
│  │  ├─ embeddings/              # embed(), chunking, similarity search
│  │  ├─ validation/              # Zod schemas
│  │  └─ risk/                    # thin wrappers calling SQL functions
│  └─ middleware.ts               # route protection
├─ storage/uploads/               # git-ignored
└─ docs/
   ├─ DECISIONS.md                # every [ASSUMED] choice and any change
   ├─ er_diagram.mmd              # generated from final DDL
   ├─ data_dictionary.md          # generated from information_schema
   ├─ REPORT.md → report.pdf
   └─ screenshots/
```

### 6.4 Environment variables `[PROPOSAL]` + `[ASSUMED]`

`.env.example` (values are placeholders; real values only in the local `.env`):

```
# PostgreSQL
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/projectpulse
DB_SEARCH_PATH=projectpulse,public
# MongoDB
MONGODB_URI=mongodb://localhost:27017/projectpulse
MONGODB_DB=projectpulse
# Auth
AUTH_SECRET=generate-a-long-random-string
SESSION_MAX_AGE_HOURS=8
# Storage
STORAGE_DRIVER=local
STORAGE_LOCAL_PATH=./storage/uploads
STORAGE_MAX_FILE_MB=10
# Embeddings
EMBEDDING_PROVIDER=local
EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2
EMBEDDING_DIM=384
SIMILARITY_THRESHOLD=0.80
SIMILARITY_TOP_K=5
# Jobs and seeding
JOB_SECRET=another-random-string          # protects POST /api/jobs/risk-sweep
SEED_DEFAULT_PASSWORD=choose-a-demo-password   # used only by the seed script
```

Docker Compose reads the Postgres/Mongo credentials from the same `.env`. **Never commit `.env`.**

### 6.5 npm scripts to provide

| Script | Purpose | Shows progress bar? |
|---|---|---|
| `dev` / `build` / `start` | Next.js | — |
| `db:up` | `docker compose up -d` | — |
| `db:migrate` | Apply pending SQL migrations in order; record in `schema_migrations` | Yes (per file) |
| `db:reset` | Drop and recreate schema, then migrate | Yes |
| `db:seed` | Insert demo data (§17) | Yes |
| `mongo:init` | Create collections, validators, indexes | Yes |
| `embed:backfill` | Embed all existing proposals/documents | Yes |
| `risk:sweep` | Recalculate risk for all active projects | Yes |
| `test` | Run SQL + API tests | — |
| `docs:data-dictionary` | Generate `docs/data_dictionary.md` from `information_schema` | — |

---

## 7. Database architecture and justification `[PROPOSAL]` `[GUIDELINE #3, #18]`

| Paradigm | Technology | Data stored and justification |
|---|---|---|
| **SQL** | PostgreSQL | Structured, transactional records: users, roles, teams, projects, milestones, tasks, assignments, deadlines, reviews, feedback, contribution evidence, risk assessments, and audit logs. PostgreSQL provides PK/FK relationships, CHECK constraints, transactions, views, triggers, stored functions, and indexes. |
| **NoSQL** | MongoDB | Semi-structured and evolving document information: SRS sections, reports, document metadata, submission versions, meeting notes, feedback threads, attachments, and extracted text. Different milestone documents need different fields. |
| **Vector** | PostgreSQL with pgvector | Embeddings for project titles, abstracts, problem statements, objectives, scope, and selected document sections. Enables semantic similarity screening and meaning-based retrieval. |

**Why not one database for everything?** (use this reasoning in the viva)
- Workflow data (who approves what, which task belongs to which milestone, can this status change to that one) needs referential integrity, transactions and constraints → relational.
- A Software Requirements Specification, a test report and a meeting note have *different shapes*; forcing them into fixed columns would create many NULLs or constant migrations → document store.
- "Are these two project abstracts about the same idea?" cannot be answered with `LIKE` or full-text search; it needs meaning-based distance between embeddings → vector search. Keeping vectors in PostgreSQL (pgvector) lets similarity queries be filtered by relational metadata (course, semester, project status) in a single query.

**Cross-database consistency rule `[ASSUMED]`:** PostgreSQL is the system of record for workflow state. MongoDB documents reference PostgreSQL by integer IDs (`projectId`, `milestoneId`, `deliverableId`). When a submission spans both, write the Mongo document first with `state: "pending"`, run the PostgreSQL transaction, then set `state: "confirmed"`; if PostgreSQL rolls back, delete the pending Mongo document (compensating action). A nightly/utility script removes orphan `pending` documents older than 1 hour.

---

## 8. PostgreSQL design (SQL component)

### 8.1 Conventions

- Schema name: `projectpulse` (created in migration 001). Every connection sets `search_path = projectpulse, public` so `vector` and `citext` (installed in `public`) resolve.
- Names are `snake_case`. Primary keys are `INT GENERATED ALWAYS AS IDENTITY`. Timestamps are `TIMESTAMPTZ` (default `now()`); calendar dates are `DATE`.
- Enumerations are `VARCHAR` + `CHECK (... IN (...))` so they are visible in the schema and easy to ALTER. Workflow transitions are enforced by a trigger reading `status_transitions` (§9.3).
- FK policies: use `ON DELETE RESTRICT` for core history (projects, milestones, reviews, evidence, audit), `ON DELETE CASCADE` only for pure child rows (e.g. `task_assignments`, `document_versions`, `template_milestones`), and `ON DELETE SET NULL` for optional references. `ON UPDATE CASCADE` where a key could legitimately change.
- Every table that has `updated_at` gets the `fn_set_updated_at` trigger.
- Dates in seed data are relative to `CURRENT_DATE` so the demo works whenever it is run.
- Tables marked `[ADDED]` are not in the old diagram; tables marked `[PROPOSAL]` are in the proposal's table list. The old diagram's 22 tables are all kept, extended with the attributes the proposal describes.

### 8.2 Table inventory

| # | Table | Origin | Purpose |
|---|---|---|---|
| 1 | `departments` | PROPOSAL | Academic departments |
| 2 | `courses` | PROPOSAL | Project courses per semester |
| 3 | `users` | PROPOSAL | Login identity and account status |
| 4 | `roles` | PROPOSAL | Role definitions |
| 5 | `user_roles` | PROPOSAL | Many-to-many user ↔ role |
| 6 | `teams` | PROPOSAL | Teams per course |
| 7 | `team_members` | PROPOSAL | Student membership + responsibility |
| 8 | `project_templates` | PROPOSAL (admin manages templates) | Reusable project plans |
| 9 | `template_milestones` | ADDED | Milestones of a template, with mandatory deliverable types |
| 10 | `projects` | PROPOSAL | Proposal and project record |
| 11 | `proposal_actions` | PROPOSAL (immutable action history) | Append-only approval history |
| 12 | `guide_allocations` | PROPOSAL | Guide/reviewer ↔ project |
| 13 | `milestones` | PROPOSAL | Dated, weighted milestones |
| 14 | `milestone_required_deliverables` | ADDED | Mandatory deliverable types per milestone |
| 15 | `tasks` | PROPOSAL | Work items |
| 16 | `task_assignments` | PROPOSAL | Many-to-many student ↔ task (owner/collaborator) |
| 17 | `deliverables` | PROPOSAL | Submission metadata |
| 18 | `document_versions` | PROPOSAL | Version history |
| 19 | `reviews` | PROPOSAL | Evaluations of milestones |
| 20 | `review_scores` | ADDED | Rubric scores per review |
| 21 | `feedback_items` | PROPOSAL | Trackable feedback → resolution workflow |
| 22 | `git_activities` | PROPOSAL | Optional manual repository activity references |
| 23 | `contribution_evidence` | PROPOSAL | Verifiable evidence per student |
| 24 | `risk_assessments` | PROPOSAL | Historical risk scores |
| 25 | `risk_events` | ADDED | Flags raised by triggers/sweep |
| 26 | `similarity_reviews` | PROPOSAL | Faculty decisions on similar projects |
| 27 | `project_embeddings` | PROPOSAL (pgvector table) | Embedding vectors + chunks |
| 28 | `peer_evaluations` | PROPOSAL | Controlled teammate feedback |
| 29 | `audit_logs` | PROPOSAL | Important actions, append-only |
| 30 | `status_transitions` | ADDED | Allowed workflow transitions |
| 31 | `notifications` | ADDED (P2) | In-app notifications |
| 32 | `schema_migrations` | ADDED | Migration bookkeeping |

### 8.3 Migration plan (version-controlled DDL) `[PROPOSAL §12]`

| File | Content |
|---|---|
| `001_extensions_schema.sql` | `CREATE EXTENSION vector, citext`; `CREATE SCHEMA projectpulse`; helper trigger function `fn_set_updated_at` |
| `002_core_identity.sql` | departments, courses, users, roles, user_roles, teams, team_members |
| `003_projects_templates.sql` | project_templates, template_milestones, projects, proposal_actions, guide_allocations, status_transitions |
| `004_milestones_tasks.sql` | milestones, milestone_required_deliverables, tasks, task_assignments |
| `005_deliverables_reviews.sql` | deliverables, document_versions, reviews, review_scores, feedback_items |
| `006_evidence_risk_similarity.sql` | git_activities, contribution_evidence, risk_assessments, risk_events, similarity_reviews, project_embeddings, peer_evaluations, audit_logs, notifications |
| `007_indexes.sql` | All B-tree, partial, GIN and the HNSW vector index |
| `008_functions.sql` | Risk, contribution, completeness, completion % functions; procedures (must exist before views) |
| `009_views.sql` | Four required views + extras |
| `010_triggers.sql` | Audit, transition validation, immutability, overdue flag, integrity triggers |
| `011_alter_demo.sql` | **ALTER** demonstration (add `milestones.required_evidence_type`, etc.) |
| `012_drop_demo.sql` | **DROP** demonstration (obsolete index/view/temporary column) |
| `013_roles_grants.sql` | `CREATE ROLE` least-privilege DB roles and grants |
| `014_reference_data.sql` | Seed `roles`, `status_transitions` (reference data only; demo data is in `db/seeds`) |

Each migration is wrapped in `BEGIN; … COMMIT;` and records itself in `schema_migrations(version, applied_at)`.

### 8.4 DDL — migration 001

```sql
-- 001_extensions_schema.sql
CREATE EXTENSION IF NOT EXISTS vector;   -- pgvector
CREATE EXTENSION IF NOT EXISTS citext;   -- case-insensitive email
CREATE SCHEMA IF NOT EXISTS projectpulse;
SET search_path = projectpulse, public;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version     VARCHAR(60) PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION fn_set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;
```

### 8.5 DDL — migration 002 (identity, academic context, teams)

```sql
-- 002_core_identity.sql
SET search_path = projectpulse, public;

CREATE TABLE departments (
  dept_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dept_code   VARCHAR(10)  NOT NULL UNIQUE,
  dept_name   VARCHAR(120) NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE courses (
  course_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dept_id        INT NOT NULL REFERENCES departments(dept_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  course_code    VARCHAR(20)  NOT NULL,
  course_name    VARCHAR(150) NOT NULL,
  semester       VARCHAR(20)  NOT NULL,                       -- e.g. 'Sem 5'
  academic_year  VARCHAR(9)   NOT NULL CHECK (academic_year ~ '^[0-9]{4}-[0-9]{4}$'),
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (course_code, semester, academic_year)
);

CREATE TABLE users (
  user_id            INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name               VARCHAR(120) NOT NULL CHECK (length(trim(name)) > 0),
  email              CITEXT       NOT NULL UNIQUE
                     CHECK (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  password_hash      TEXT         NOT NULL,                  -- bcrypt hash, never plain text
  status             VARCHAR(12)  NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','inactive','suspended')),
  dept_id            INT REFERENCES departments(dept_id) ON DELETE SET NULL ON UPDATE CASCADE,
  identifier         VARCHAR(30) UNIQUE,                     -- USN / employee id (optional)
  failed_login_count INT NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
  locked_until       TIMESTAMPTZ,
  last_login_at      TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE roles (
  role_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  role_name    VARCHAR(20) NOT NULL UNIQUE
               CHECK (role_name IN ('student','faculty_guide','reviewer','admin')),
  description  TEXT
);

CREATE TABLE user_roles (
  user_id      INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  role_id      INT NOT NULL REFERENCES roles(role_id) ON DELETE RESTRICT,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by  INT REFERENCES users(user_id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE teams (
  team_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id   INT NOT NULL REFERENCES courses(course_id) ON DELETE RESTRICT ON UPDATE CASCADE,
  team_name   VARCHAR(80) NOT NULL,
  created_by  INT REFERENCES users(user_id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (course_id, team_name),
  UNIQUE (team_id, course_id)        -- lets child tables carry course_id via a composite FK
);

-- A student may be in only ONE team per course: course_id is copied here through a
-- composite FK to teams, so UNIQUE(course_id, user_id) is enforced by the database itself.
CREATE TABLE team_members (
  team_id         INT NOT NULL,
  course_id       INT NOT NULL,
  user_id         INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  member_role     VARCHAR(10) NOT NULL DEFAULT 'member' CHECK (member_role IN ('leader','member')),
  responsibility  VARCHAR(200),
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, user_id),
  FOREIGN KEY (team_id, course_id) REFERENCES teams(team_id, course_id)
      ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE (course_id, user_id)
);
CREATE UNIQUE INDEX uq_one_leader_per_team ON team_members(team_id) WHERE member_role = 'leader';

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
```

### 8.6 DDL — migration 003 (projects, templates, allocations, transitions)

```sql
-- 003_projects_templates.sql
SET search_path = projectpulse, public;

CREATE TABLE project_templates (
  template_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  course_id    INT REFERENCES courses(course_id) ON DELETE SET NULL,
  name         VARCHAR(120) NOT NULL UNIQUE,
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_by   INT REFERENCES users(user_id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE template_milestones (
  template_milestone_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  template_id            INT NOT NULL REFERENCES project_templates(template_id) ON DELETE CASCADE,
  sequence_no            INT NOT NULL CHECK (sequence_no > 0),
  title                  VARCHAR(150) NOT NULL,
  offset_days            INT NOT NULL CHECK (offset_days >= 0),    -- due date = project start + offset
  weightage              NUMERIC(5,2) NOT NULL CHECK (weightage > 0 AND weightage <= 100),
  required_deliverable_types TEXT[] NOT NULL DEFAULT '{}',
  UNIQUE (template_id, sequence_no)
);

CREATE TABLE projects (
  project_id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  team_id            INT NOT NULL,
  course_id          INT NOT NULL,
  template_id        INT REFERENCES project_templates(template_id) ON DELETE SET NULL,
  title              VARCHAR(200) NOT NULL CHECK (length(trim(title)) >= 5),
  abstract           TEXT,
  problem_statement  TEXT,
  objectives         TEXT,
  scope              TEXT,
  domain             VARCHAR(80),
  technologies       TEXT[] NOT NULL DEFAULT '{}',
  repo_link          TEXT CHECK (repo_link IS NULL OR repo_link ~* '^https?://'),
  status             VARCHAR(20) NOT NULL DEFAULT 'draft'
                     CHECK (status IN ('draft','submitted','revision_requested','approved',
                                       'rejected','in_progress','completed','archived')),
  start_date         DATE,
  end_date           DATE,
  created_by         INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  submitted_at       TIMESTAMPTZ,
  approved_by        INT REFERENCES users(user_id) ON DELETE SET NULL,
  approved_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (team_id, course_id) REFERENCES teams(team_id, course_id)
      ON DELETE RESTRICT ON UPDATE CASCADE,
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date),
  -- Drafts may be incomplete; anything beyond draft must have the full proposal text.
  CHECK (status = 'draft' OR (
        abstract IS NOT NULL AND length(abstract) >= 50 AND
        problem_statement IS NOT NULL AND length(problem_statement) >= 30 AND
        objectives IS NOT NULL AND scope IS NOT NULL AND domain IS NOT NULL))
);
-- One ACTIVE project per team (rejected/archived ones do not block a new proposal).
CREATE UNIQUE INDEX uq_projects_active_team ON projects(team_id)
  WHERE status NOT IN ('rejected','archived');
-- No two active proposals in a course with the same title (case-insensitive).
CREATE UNIQUE INDEX uq_projects_course_title ON projects(course_id, lower(title))
  WHERE status NOT IN ('rejected','archived');
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Immutable approval history (UPDATE/DELETE blocked by trigger in migration 010)
CREATE TABLE proposal_actions (
  action_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id   INT NOT NULL REFERENCES projects(project_id) ON DELETE RESTRICT,
  actor_id     INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  action       VARCHAR(20) NOT NULL
               CHECK (action IN ('submit','resubmit','approve','reject','request_revision')),
  from_status  VARCHAR(20) NOT NULL,
  to_status    VARCHAR(20) NOT NULL,
  comments     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- reject / request_revision must carry an explanation
  CHECK (action NOT IN ('reject','request_revision') OR length(trim(coalesce(comments,''))) > 0)
);

CREATE TABLE guide_allocations (
  allocation_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id       INT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  user_id          INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  allocation_role  VARCHAR(10) NOT NULL CHECK (allocation_role IN ('guide','reviewer')),
  allocated_by     INT REFERENCES users(user_id) ON DELETE SET NULL,
  allocated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id, allocation_role)
);
CREATE UNIQUE INDEX uq_one_guide_per_project ON guide_allocations(project_id)
  WHERE allocation_role = 'guide';

-- Data-driven workflow: which status changes are legal (used by trigger fn_validate_transition)
CREATE TABLE status_transitions (
  entity_type  VARCHAR(30) NOT NULL,
  from_status  VARCHAR(25) NOT NULL,
  to_status    VARCHAR(25) NOT NULL,
  PRIMARY KEY (entity_type, from_status, to_status)
);
```

### 8.7 DDL — migration 004 (milestones, tasks)

```sql
-- 004_milestones_tasks.sql
SET search_path = projectpulse, public;

CREATE TABLE milestones (
  milestone_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id         INT NOT NULL REFERENCES projects(project_id) ON DELETE RESTRICT,
  sequence_no        INT NOT NULL CHECK (sequence_no > 0),
  title              VARCHAR(150) NOT NULL,
  description        TEXT,
  start_date         DATE,
  due_date           DATE NOT NULL,
  status             VARCHAR(20) NOT NULL DEFAULT 'planned'
                     CHECK (status IN ('planned','in_progress','submitted','under_review',
                                       'approved','revision_requested','rejected')),
  weightage          NUMERIC(5,2) NOT NULL CHECK (weightage > 0 AND weightage <= 100),
  submitted_at       TIMESTAMPTZ,
  approved_by        INT REFERENCES users(user_id) ON DELETE SET NULL,
  approved_at        TIMESTAMPTZ,
  approval_comments  TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, sequence_no),
  CHECK (start_date IS NULL OR due_date >= start_date),
  CHECK (status <> 'approved' OR (approved_by IS NOT NULL AND approved_at IS NOT NULL))
);
-- (Total weightage per project <= 100 is enforced by a trigger in migration 010.)
CREATE TRIGGER trg_milestones_updated BEFORE UPDATE ON milestones
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- Mandatory deliverable types for each milestone (used for "missing deliverable" detection)
CREATE TABLE milestone_required_deliverables (
  milestone_id      INT NOT NULL REFERENCES milestones(milestone_id) ON DELETE CASCADE,
  deliverable_type  VARCHAR(30) NOT NULL
                    CHECK (deliverable_type IN ('proposal','srs','design_doc','source_code',
                                'screenshot','test_report','presentation','final_report','other')),
  PRIMARY KEY (milestone_id, deliverable_type)
);

CREATE TABLE tasks (
  task_id                  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  milestone_id             INT NOT NULL REFERENCES milestones(milestone_id) ON DELETE RESTRICT,
  title                    VARCHAR(150) NOT NULL,
  description              TEXT,
  status                   VARCHAR(12) NOT NULL DEFAULT 'todo'
                           CHECK (status IN ('todo','in_progress','blocked','done','verified')),
  priority                 VARCHAR(8) NOT NULL DEFAULT 'medium'
                           CHECK (priority IN ('low','medium','high')),
  effort_hours             NUMERIC(6,2) NOT NULL DEFAULT 1 CHECK (effort_hours > 0),
  planned_start_date       DATE,
  planned_completion_date  DATE NOT NULL,
  actual_completion_date   DATE,
  due_date                 DATE NOT NULL,
  verified_by              INT REFERENCES users(user_id) ON DELETE SET NULL,
  verified_at              TIMESTAMPTZ,
  created_by               INT REFERENCES users(user_id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (planned_start_date IS NULL OR planned_completion_date >= planned_start_date),
  CHECK (due_date >= COALESCE(planned_start_date, due_date)),
  CHECK (actual_completion_date IS NULL OR status IN ('done','verified')),
  CHECK (status <> 'verified' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL))
);
CREATE TRIGGER trg_tasks_updated BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TABLE task_assignments (
  task_id          INT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  user_id          INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  assignment_type  VARCHAR(12) NOT NULL DEFAULT 'owner' CHECK (assignment_type IN ('owner','collaborator')),
  assigned_by      INT REFERENCES users(user_id) ON DELETE SET NULL,
  assigned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (task_id, user_id)
);
CREATE UNIQUE INDEX uq_one_owner_per_task ON task_assignments(task_id)
  WHERE assignment_type = 'owner';
```

### 8.8 DDL — migration 005 (deliverables, reviews, feedback)

```sql
-- 005_deliverables_reviews.sql
SET search_path = projectpulse, public;

CREATE TABLE deliverables (
  deliverable_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  milestone_id      INT NOT NULL REFERENCES milestones(milestone_id) ON DELETE RESTRICT,
  deliverable_type  VARCHAR(30) NOT NULL
                    CHECK (deliverable_type IN ('proposal','srs','design_doc','source_code',
                                'screenshot','test_report','presentation','final_report','other')),
  title             VARCHAR(200) NOT NULL,
  repo_link         TEXT CHECK (repo_link IS NULL OR repo_link ~* '^https?://'),
  evidence_url      TEXT CHECK (evidence_url IS NULL OR evidence_url ~* '^https?://'),
  mongo_doc_id      VARCHAR(40),                       -- _id of the matching MongoDB document
  status            VARCHAR(10) NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft','submitted','accepted','rejected')),
  submitted_by      INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  submitted_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (status = 'draft' OR submitted_at IS NOT NULL)
);
CREATE TRIGGER trg_deliverables_updated BEFORE UPDATE ON deliverables
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

CREATE TABLE document_versions (
  version_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  deliverable_id   INT NOT NULL REFERENCES deliverables(deliverable_id) ON DELETE CASCADE,
  version_number   INT NOT NULL CHECK (version_number > 0),
  change_summary   VARCHAR(500) NOT NULL,
  file_name        VARCHAR(255),
  file_url         TEXT,                                -- secure internal path or external link
  file_size_bytes  BIGINT CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
  checksum_sha256  CHAR(64),
  uploaded_by      INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  uploaded_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (deliverable_id, version_number),
  CHECK (file_url IS NOT NULL OR file_name IS NOT NULL)
);

CREATE TABLE reviews (
  review_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  milestone_id  INT NOT NULL REFERENCES milestones(milestone_id) ON DELETE RESTRICT,
  reviewer_id   INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  review_type   VARCHAR(10) NOT NULL DEFAULT 'milestone' CHECK (review_type IN ('milestone','final')),
  decision      VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (decision IN ('pending','approved','revision_requested','rejected')),
  comments      TEXT,
  total_score   NUMERIC(5,2) CHECK (total_score IS NULL OR (total_score >= 0 AND total_score <= 100)),
  review_date   DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (decision = 'pending' OR review_date IS NOT NULL)
);

CREATE TABLE review_scores (
  review_id   INT NOT NULL REFERENCES reviews(review_id) ON DELETE CASCADE,
  criterion   VARCHAR(80) NOT NULL,
  max_score   NUMERIC(5,2) NOT NULL CHECK (max_score > 0),
  score       NUMERIC(5,2) NOT NULL CHECK (score >= 0),
  PRIMARY KEY (review_id, criterion),
  CHECK (score <= max_score)
);

CREATE TABLE feedback_items (
  feedback_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  review_id          INT NOT NULL REFERENCES reviews(review_id) ON DELETE RESTRICT,
  created_by         INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,   -- faculty/reviewer
  assigned_user_id   INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,   -- student who must resolve
  description        TEXT NOT NULL CHECK (length(trim(description)) > 0),
  severity           VARCHAR(8) NOT NULL DEFAULT 'minor' CHECK (severity IN ('minor','major','critical')),
  resolution_status  VARCHAR(12) NOT NULL DEFAULT 'open'
                     CHECK (resolution_status IN ('open','in_progress','resolved','verified','reopened')),
  response_text      TEXT,
  due_date           DATE,
  resolved_at        TIMESTAMPTZ,
  verified_by        INT REFERENCES users(user_id) ON DELETE SET NULL,
  verified_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (resolution_status NOT IN ('resolved','verified') OR resolved_at IS NOT NULL),
  CHECK (resolution_status <> 'verified' OR (verified_by IS NOT NULL AND verified_at IS NOT NULL))
);
CREATE TRIGGER trg_feedback_updated BEFORE UPDATE ON feedback_items
  FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();
```

### 8.9 DDL — migration 006 (evidence, risk, similarity, embeddings, peer evaluation, audit)

```sql
-- 006_evidence_risk_similarity.sql
SET search_path = projectpulse, public;

CREATE TABLE git_activities (
  git_id          INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id      INT NOT NULL REFERENCES projects(project_id) ON DELETE RESTRICT,
  task_id         INT REFERENCES tasks(task_id) ON DELETE SET NULL,
  user_id         INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  repo_url        TEXT NOT NULL CHECK (repo_url ~* '^https?://'),
  commit_ref      VARCHAR(64) NOT NULL,
  commit_message  VARCHAR(300),
  committed_at    TIMESTAMPTZ,
  recorded_by     INT REFERENCES users(user_id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (repo_url, commit_ref)
);

CREATE TABLE contribution_evidence (
  evidence_id    INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id     INT NOT NULL REFERENCES projects(project_id) ON DELETE RESTRICT,
  user_id        INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  task_id        INT REFERENCES tasks(task_id) ON DELETE SET NULL,
  evidence_type  VARCHAR(25) NOT NULL
                 CHECK (evidence_type IN ('task_completed','document_upload','feedback_resolved',
                                          'git_activity','review_participation')),
  description    VARCHAR(300),
  weight         NUMERIC(4,2) NOT NULL DEFAULT 1 CHECK (weight > 0 AND weight <= 10),
  verified_flag  BOOLEAN NOT NULL DEFAULT FALSE,
  verified_by    INT REFERENCES users(user_id) ON DELETE SET NULL,
  verified_at    TIMESTAMPTZ,
  source_table   VARCHAR(40),            -- which table produced it (tasks, document_versions, ...)
  source_id      INT,                    -- primary key in that table
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (NOT verified_flag OR (verified_by IS NOT NULL AND verified_at IS NOT NULL)),
  UNIQUE (source_table, source_id, user_id, evidence_type)   -- no duplicate auto-evidence
);

CREATE TABLE risk_assessments (
  risk_id         INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id      INT NOT NULL REFERENCES projects(project_id) ON DELETE RESTRICT,
  risk_score      NUMERIC(5,2) NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  risk_level      VARCHAR(10) NOT NULL CHECK (risk_level IN ('low','moderate','high','critical')),
  reason          TEXT NOT NULL,                 -- human-readable explanation
  breakdown       JSONB NOT NULL DEFAULT '{}',   -- points per risk factor
  calculated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- level must match the score band (24/49/74 thresholds, see §9.6)
  CHECK ((risk_level = 'low' AND risk_score < 25) OR
         (risk_level = 'moderate' AND risk_score >= 25 AND risk_score < 50) OR
         (risk_level = 'high' AND risk_score >= 50 AND risk_score < 75) OR
         (risk_level = 'critical' AND risk_score >= 75))
);

CREATE TABLE risk_events (
  event_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id    INT NOT NULL REFERENCES projects(project_id) ON DELETE RESTRICT,
  milestone_id  INT REFERENCES milestones(milestone_id) ON DELETE SET NULL,
  event_type    VARCHAR(30) NOT NULL
                CHECK (event_type IN ('milestone_overdue','task_overdue','feedback_unresolved',
                                      'inactivity','missing_deliverable','contribution_imbalance')),
  details       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at   TIMESTAMPTZ
);
-- only one OPEN event of the same type per milestone/project
CREATE UNIQUE INDEX uq_open_risk_event ON risk_events(project_id, event_type, COALESCE(milestone_id, 0))
  WHERE resolved_at IS NULL;

CREATE TABLE similarity_reviews (
  similarity_id        INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_project_id    INT NOT NULL REFERENCES projects(project_id) ON DELETE RESTRICT,
  matched_project_id   INT NOT NULL REFERENCES projects(project_id) ON DELETE RESTRICT,
  similarity_score     NUMERIC(5,4) NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
  matched_section      VARCHAR(20),
  source_excerpt       TEXT,
  matched_excerpt      TEXT,
  faculty_decision     VARCHAR(20) NOT NULL DEFAULT 'pending'
                       CHECK (faculty_decision IN ('pending','not_similar','acceptable_overlap',
                                                   'needs_revision','escalated')),
  comments             TEXT,
  reviewed_by          INT REFERENCES users(user_id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at           TIMESTAMPTZ,
  CHECK (source_project_id <> matched_project_id),
  CHECK (faculty_decision = 'pending' OR (reviewed_by IS NOT NULL AND decided_at IS NOT NULL)),
  UNIQUE (source_project_id, matched_project_id)
);

-- pgvector table (vector database component)
CREATE TABLE project_embeddings (
  embedding_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id    INT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
  course_id     INT NOT NULL REFERENCES courses(course_id) ON DELETE RESTRICT,  -- for metadata filtering
  section_type  VARCHAR(20) NOT NULL
                CHECK (section_type IN ('title','abstract','problem_statement','objectives',
                                        'scope','document_chunk')),
  chunk_index   INT NOT NULL DEFAULT 0 CHECK (chunk_index >= 0),
  chunk_text    TEXT NOT NULL,
  embedding     vector(384) NOT NULL,
  model_name    VARCHAR(80) NOT NULL,
  is_current    BOOLEAN NOT NULL DEFAULT TRUE,   -- FALSE for superseded/rejected content
  access_level  VARCHAR(10) NOT NULL DEFAULT 'faculty' CHECK (access_level IN ('faculty','admin')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, section_type, chunk_index, model_name)
);

CREATE TABLE peer_evaluations (
  evaluation_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  project_id     INT NOT NULL REFERENCES projects(project_id) ON DELETE RESTRICT,
  milestone_id   INT REFERENCES milestones(milestone_id) ON DELETE SET NULL,  -- evaluation period
  evaluator_id   INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  evaluatee_id   INT NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  score          NUMERIC(3,1) NOT NULL CHECK (score >= 1 AND score <= 5),
  comments       VARCHAR(500),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (evaluator_id <> evaluatee_id),
  UNIQUE (project_id, milestone_id, evaluator_id, evaluatee_id)
);

CREATE TABLE audit_logs (
  log_id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      INT REFERENCES users(user_id) ON DELETE SET NULL,
  action       VARCHAR(30) NOT NULL,        -- INSERT / UPDATE / DELETE / STATUS_CHANGE / DECISION ...
  entity_type  VARCHAR(40) NOT NULL,
  entity_id    VARCHAR(40),
  old_values   JSONB,
  new_values   JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE notifications (   -- P2
  notification_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id          INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  type             VARCHAR(30) NOT NULL,
  message          VARCHAR(300) NOT NULL,
  link             VARCHAR(200),
  is_read          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 8.10 Indexes — migration 007 `[PROPOSAL §12]`

The proposal asks for indexes on project status, milestone due date/status, task assignee/status, feedback status, risk category, document metadata, and pgvector. Create them, and **record `EXPLAIN ANALYZE` before/after for at least three queries** in the report.

```sql
-- 007_indexes.sql
SET search_path = projectpulse, public;

CREATE INDEX idx_projects_status          ON projects(status);
CREATE INDEX idx_projects_course_status   ON projects(course_id, status);
CREATE INDEX idx_milestones_due_status    ON milestones(due_date, status);
CREATE INDEX idx_milestones_project       ON milestones(project_id, sequence_no);
CREATE INDEX idx_tasks_milestone_status   ON tasks(milestone_id, status);
CREATE INDEX idx_tasks_due_open           ON tasks(due_date) WHERE status NOT IN ('done','verified'); -- partial
CREATE INDEX idx_task_assign_user         ON task_assignments(user_id);        -- "task assignee"
CREATE INDEX idx_feedback_status          ON feedback_items(resolution_status);
CREATE INDEX idx_feedback_assignee_open   ON feedback_items(assigned_user_id)
                                          WHERE resolution_status IN ('open','in_progress','reopened');
CREATE INDEX idx_reviews_milestone        ON reviews(milestone_id);
CREATE INDEX idx_risk_project_time        ON risk_assessments(project_id, calculated_at DESC);
CREATE INDEX idx_risk_level               ON risk_assessments(risk_level);      -- "risk category"
CREATE INDEX idx_evidence_project_user    ON contribution_evidence(project_id, user_id) WHERE verified_flag;
CREATE INDEX idx_deliverables_milestone   ON deliverables(milestone_id, deliverable_type, status); -- "document metadata"
CREATE INDEX idx_docver_deliverable       ON document_versions(deliverable_id, version_number DESC);
CREATE INDEX idx_audit_entity             ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX idx_audit_user_time          ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_team_members_user        ON team_members(user_id);
CREATE INDEX idx_similarity_decision      ON similarity_reviews(faculty_decision);
CREATE INDEX idx_notifications_unread     ON notifications(user_id) WHERE NOT is_read;
-- Full-text search on proposals (extra advanced feature: full-text search)
CREATE INDEX idx_projects_fts ON projects USING GIN (
  to_tsvector('english', coalesce(title,'') || ' ' || coalesce(abstract,'') || ' ' || coalesce(problem_statement,'')));

-- Vector index (pgvector): cosine distance, HNSW
CREATE INDEX idx_embeddings_hnsw ON project_embeddings
  USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 64);
CREATE INDEX idx_embeddings_filter ON project_embeddings(course_id, section_type) WHERE is_current;
```

### 8.11 Views — migration 009 `[PROPOSAL §12, §14]`

Required views: **faculty risk dashboard**, **project progress**, **contribution summary**, **unresolved feedback**.

```sql
-- 009_views.sql
SET search_path = projectpulse, public;

-- 1. Project progress (weighted by milestone weightage; approved milestone = 100%)
CREATE OR REPLACE VIEW v_project_progress AS
SELECT p.project_id, p.title, p.status AS project_status,
       COUNT(m.milestone_id)                                         AS milestone_count,
       COUNT(*) FILTER (WHERE m.status = 'approved')                 AS milestones_approved,
       COALESCE(ROUND(SUM(m.weightage * fn_milestone_completion_pct(m.milestone_id)) / NULLIF(SUM(m.weightage),0), 1), 0)
                                                                      AS progress_pct
FROM projects p
LEFT JOIN milestones m ON m.project_id = p.project_id
GROUP BY p.project_id, p.title, p.status;

-- 2. Unresolved feedback (open / in_progress / reopened / resolved-but-not-verified)
CREATE OR REPLACE VIEW v_unresolved_feedback AS
SELECT f.feedback_id, f.description, f.severity, f.resolution_status, f.due_date,
       (f.due_date IS NOT NULL AND f.due_date < CURRENT_DATE)         AS is_overdue,
       r.review_id, m.milestone_id, m.title AS milestone_title,
       p.project_id, p.title AS project_title, t.team_name,
       u.user_id AS assigned_user_id, u.name AS assigned_to,
       CURRENT_DATE - f.created_at::date                               AS age_days
FROM feedback_items f
JOIN reviews r     ON r.review_id = f.review_id
JOIN milestones m  ON m.milestone_id = r.milestone_id
JOIN projects p    ON p.project_id = m.project_id
JOIN teams t       ON t.team_id = p.team_id
JOIN users u       ON u.user_id = f.assigned_user_id
WHERE f.resolution_status <> 'verified';

-- 3. Contribution summary per member (verified evidence only) + share of team total
CREATE OR REPLACE VIEW v_contribution_summary AS
WITH per_member AS (
  SELECT p.project_id, tm.user_id,
         COALESCE(SUM(ce.weight * CASE ce.evidence_type
                WHEN 'task_completed' THEN 3 WHEN 'document_upload' THEN 2
                WHEN 'feedback_resolved' THEN 2 WHEN 'review_participation' THEN 1
                WHEN 'git_activity' THEN 1 END) FILTER (WHERE ce.verified_flag), 0) AS evidence_points,
         COUNT(ce.evidence_id) FILTER (WHERE ce.verified_flag)   AS verified_items,
         COUNT(ce.evidence_id) FILTER (WHERE NOT ce.verified_flag) AS unverified_items
  FROM projects p
  JOIN team_members tm ON tm.team_id = p.team_id
  LEFT JOIN contribution_evidence ce ON ce.project_id = p.project_id AND ce.user_id = tm.user_id
  GROUP BY p.project_id, tm.user_id
)
SELECT pm.project_id, pm.user_id, u.name, pm.verified_items, pm.unverified_items, pm.evidence_points,
       ROUND(100 * pm.evidence_points / NULLIF(SUM(pm.evidence_points) OVER (PARTITION BY pm.project_id), 0), 1)
                                                                  AS share_pct,
       ROUND(AVG(pe.score), 2)                                    AS avg_peer_score
FROM per_member pm
JOIN users u ON u.user_id = pm.user_id
LEFT JOIN peer_evaluations pe ON pe.project_id = pm.project_id AND pe.evaluatee_id = pm.user_id
GROUP BY pm.project_id, pm.user_id, u.name, pm.verified_items, pm.unverified_items, pm.evidence_points;

-- 4. Faculty risk dashboard (progress, overdue count, missing evidence, unresolved feedback,
--    latest risk score, days remaining) — exactly the columns the proposal lists
CREATE OR REPLACE VIEW v_faculty_risk_dashboard AS
SELECT p.project_id, p.title, p.status AS project_status,
       t.team_id, t.team_name, c.course_id, c.course_name, c.semester,
       ga.user_id AS guide_id,
       pr.progress_pct,
       (SELECT COUNT(*) FROM tasks tk JOIN milestones m ON m.milestone_id = tk.milestone_id
         WHERE m.project_id = p.project_id AND tk.due_date < CURRENT_DATE
           AND tk.status NOT IN ('done','verified'))                              AS overdue_tasks,
       (SELECT COUNT(*) FROM milestone_required_deliverables r JOIN milestones m ON m.milestone_id = r.milestone_id
         WHERE m.project_id = p.project_id AND m.due_date <= CURRENT_DATE + 7 AND m.status <> 'approved'
           AND NOT EXISTS (SELECT 1 FROM deliverables d WHERE d.milestone_id = m.milestone_id
                             AND d.deliverable_type = r.deliverable_type AND d.status IN ('submitted','accepted')))
                                                                                    AS missing_evidence,
       (SELECT COUNT(*) FROM v_unresolved_feedback uf WHERE uf.project_id = p.project_id) AS unresolved_feedback,
       lr.risk_score, lr.risk_level, lr.reason, lr.calculated_at,
       (SELECT MIN(m.due_date) FROM milestones m
         WHERE m.project_id = p.project_id AND m.status <> 'approved') - CURRENT_DATE AS days_to_next_deadline
FROM projects p
JOIN teams t   ON t.team_id = p.team_id
JOIN courses c ON c.course_id = p.course_id
JOIN v_project_progress pr ON pr.project_id = p.project_id
LEFT JOIN guide_allocations ga ON ga.project_id = p.project_id AND ga.allocation_role = 'guide'
LEFT JOIN LATERAL (SELECT ra.* FROM risk_assessments ra WHERE ra.project_id = p.project_id
                   ORDER BY ra.calculated_at DESC LIMIT 1) lr ON TRUE
WHERE p.status IN ('approved','in_progress');
```

Extra views `[ADDED]`: `v_overdue_tasks_by_team` (team, overdue count), `v_missing_mandatory_deliverables` (project, milestone, missing type), `v_latest_risk` (one latest row per project).

### 8.12 ALTER and DROP demonstrations — migrations 011 and 012 `[PROPOSAL §12]`

```sql
-- 011_alter_demo.sql  — documented schema change (ALTER)
SET search_path = projectpulse, public;
-- Why: some milestones need one specific kind of evidence attached before a guide may approve them.
ALTER TABLE milestones
  ADD COLUMN required_evidence_type VARCHAR(30)
  CHECK (required_evidence_type IS NULL OR required_evidence_type IN
        ('proposal','srs','design_doc','source_code','screenshot','test_report','presentation','final_report','other'));
-- Second ALTER examples to include (any two are enough, document why):
ALTER TABLE tasks ADD CONSTRAINT chk_task_effort_max CHECK (effort_hours <= 200);
ALTER TABLE projects ALTER COLUMN technologies SET DEFAULT '{}';
-- A trigger/function in migration 010 uses required_evidence_type when approving a milestone.
```

```sql
-- 012_drop_demo.sql  — safe development clean-up (DROP)
SET search_path = projectpulse, public;
-- A temporary index and view created earlier while experimenting are now obsolete.
CREATE INDEX IF NOT EXISTS idx_tmp_tasks_title ON tasks(title);       -- created only to be dropped
CREATE VIEW v_tmp_task_list AS SELECT task_id, title FROM tasks;      -- created only to be dropped
DROP VIEW  IF EXISTS v_tmp_task_list;
DROP INDEX IF EXISTS idx_tmp_tasks_title;
ALTER TABLE git_activities ADD COLUMN tmp_notes TEXT;
ALTER TABLE git_activities DROP COLUMN tmp_notes;                      -- temporary column removed
-- Document in docs/DECISIONS.md: why each object existed and why dropping is safe (no dependents).
```

### 8.13 DB roles and grants — migration 013

The proposal says "roles as needed". Create least-privilege roles so the app does not connect as the superuser:

```sql
-- 013_roles_grants.sql  (passwords supplied by the migration runner from env, never hard-coded)
CREATE ROLE pp_app LOGIN PASSWORD :'APP_DB_PASSWORD';     -- psql variable / runner substitution
GRANT USAGE ON SCHEMA projectpulse TO pp_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA projectpulse TO pp_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA projectpulse TO pp_app;
REVOKE UPDATE, DELETE ON projectpulse.audit_logs, projectpulse.proposal_actions FROM pp_app;  -- append-only
ALTER ROLE pp_app SET search_path = projectpulse, public;
```
The app's `DATABASE_URL` uses `pp_app`; migrations use an owner/admin URL (`MIGRATION_DATABASE_URL`, add to `.env.example`). Skip this migration's runtime use if it causes trouble on the demo machine (P1).

### 8.14 Reference data — migration 014 (status workflow, roles)

```sql
-- 014_reference_data.sql
SET search_path = projectpulse, public;
INSERT INTO roles(role_name, description) VALUES
  ('student','Creates proposals, works on tasks, submits evidence'),
  ('faculty_guide','Reviews, gives feedback, approves milestones'),
  ('reviewer','Reviews allocated submissions'),
  ('admin','Manages users, courses, allocations, reports');

INSERT INTO status_transitions(entity_type, from_status, to_status) VALUES
 -- project / proposal
 ('project','draft','submitted'),
 ('project','submitted','approved'), ('project','submitted','rejected'), ('project','submitted','revision_requested'),
 ('project','revision_requested','submitted'),
 ('project','approved','in_progress'), ('project','in_progress','completed'),
 ('project','completed','archived'), ('project','rejected','archived'),
 -- milestone
 ('milestone','planned','in_progress'), ('milestone','in_progress','submitted'),
 ('milestone','submitted','under_review'), ('milestone','under_review','approved'),
 ('milestone','under_review','revision_requested'), ('milestone','under_review','rejected'),
 ('milestone','revision_requested','in_progress'), ('milestone','rejected','in_progress'),
 -- task
 ('task','todo','in_progress'), ('task','in_progress','blocked'), ('task','blocked','in_progress'),
 ('task','in_progress','done'), ('task','done','in_progress'), ('task','done','verified'),
 -- feedback
 ('feedback','open','in_progress'), ('feedback','open','resolved'), ('feedback','in_progress','resolved'),
 ('feedback','resolved','verified'), ('feedback','resolved','reopened'),
 ('feedback','reopened','in_progress'), ('feedback','reopened','resolved'),
 -- deliverable
 ('deliverable','draft','submitted'), ('deliverable','submitted','accepted'),
 ('deliverable','submitted','rejected'), ('deliverable','rejected','draft'),
 -- similarity decision
 ('similarity','pending','not_similar'), ('similarity','pending','acceptable_overlap'),
 ('similarity','pending','needs_revision'), ('similarity','pending','escalated'),
 ('similarity','escalated','not_similar'), ('similarity','escalated','acceptable_overlap'),
 ('similarity','escalated','needs_revision');
```

(The `escalated → …` rows let a faculty member resolve an escalated case later; adjust if the team prefers a simpler flow.)

---

## 9. Advanced database features `[PROPOSAL §14]` `[GUIDELINE #7]`

The guidelines require **at least four**. ProjectPulse demonstrates the following; each must have a runnable example in `db/queries/` or `db/tests/` and a screenshot in the report.

| # | Feature | ProjectPulse implementation |
|---|---|---|
| 1 | **Transactions** | Milestone submission is atomic: deliverable metadata, document version, milestone status update, review request, and audit log either all succeed or all roll back (§9.5). Also proposal decision + action history + audit. |
| 2 | **Views** | Faculty risk dashboard, project progress, contribution summary, unresolved feedback (§8.11). |
| 3 | **Stored functions / procedures** | Calculate delivery risk, contribution indicator, documentation completeness, milestone completion percentage (§9.2). |
| 4 | **Triggers** | Audit entries on status changes; flag/create risk events when milestones become overdue; transition validation; immutability; integrity checks (§9.3). |
| 5 | **Indexing** | B-tree, partial and composite indexes for workflow queries; HNSW vector index (§8.10). |
| 6 | **NoSQL aggregation** | MongoDB aggregation summarises document versions, required-document completion, feedback patterns (§11). |
| 7 | **Vector similarity search** | pgvector retrieves semantically similar titles, abstracts, problem statements (§12). |
| 8 | **Full-text search** `[ADDED]` | GIN `to_tsvector` index for keyword search over proposals (complements semantic search). |

### 9.1 Where logic lives (design rule)

Integrity rules that must hold **no matter which client writes data** live in the database (CHECK, FK, triggers). Orchestration that needs the current user, files, or two databases lives in Route Handlers. The API sets `SET LOCAL app.current_user_id = '<id>'` at the start of every transaction so triggers can attribute audit rows to the right person.

### 9.2 Functions and procedures — migration 008

```sql
-- 008_functions.sql
SET search_path = projectpulse, public;

-- Milestone completion %: effort-weighted share of tasks that are done/verified; approved = 100.
CREATE OR REPLACE FUNCTION fn_milestone_completion_pct(p_milestone_id INT) RETURNS NUMERIC
LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN m.status = 'approved' THEN 100
    WHEN NOT EXISTS (SELECT 1 FROM tasks t WHERE t.milestone_id = m.milestone_id) THEN 0
    ELSE ROUND(100 * (SELECT COALESCE(SUM(t.effort_hours) FILTER (WHERE t.status IN ('done','verified')), 0)
                             / NULLIF(SUM(t.effort_hours), 0)
                      FROM tasks t WHERE t.milestone_id = m.milestone_id), 1)
  END
  FROM milestones m WHERE m.milestone_id = p_milestone_id;
$$;

-- Documentation completeness %: required deliverable types (for milestones due within 7 days
-- or earlier) that already have a submitted/accepted deliverable.
CREATE OR REPLACE FUNCTION fn_documentation_completeness(p_project_id INT) RETURNS NUMERIC
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(ROUND(100.0 * COUNT(x.deliverable_id) / NULLIF(COUNT(*), 0), 1), 0)
  FROM milestone_required_deliverables r
  JOIN milestones m ON m.milestone_id = r.milestone_id
  LEFT JOIN LATERAL (
        SELECT d.deliverable_id FROM deliverables d
        WHERE d.milestone_id = r.milestone_id AND d.deliverable_type = r.deliverable_type
          AND d.status IN ('submitted','accepted') LIMIT 1) x ON TRUE
  WHERE m.project_id = p_project_id AND m.due_date <= CURRENT_DATE + 7;
$$;

-- Contribution indicator (0–100): 80% evidence share + 20% peer-evaluation share (see §9.6).
-- plpgsql (not sql) so it can read the view v_contribution_summary created in migration 009.
CREATE OR REPLACE FUNCTION fn_contribution_indicator(p_project_id INT, p_user_id INT) RETURNS NUMERIC
LANGUAGE plpgsql STABLE AS $$
DECLARE v_result NUMERIC;
BEGIN
  WITH s AS (
    SELECT user_id, share_pct, avg_peer_score,
           SUM(avg_peer_score) OVER () AS peer_total
    FROM v_contribution_summary WHERE project_id = p_project_id)
  SELECT ROUND(0.8 * COALESCE(share_pct, 0)
             + 0.2 * COALESCE(100 * avg_peer_score / NULLIF(peer_total, 0), share_pct, 0), 1)
  INTO v_result FROM s WHERE user_id = p_user_id;
  RETURN COALESCE(v_result, 0);
END $$;

-- Delivery risk: returns score (0–100), level, plain-English reason, and per-factor breakdown.
CREATE OR REPLACE FUNCTION fn_calculate_project_risk(p_project_id INT)
RETURNS TABLE (risk_score NUMERIC, risk_level TEXT, reason TEXT, breakdown JSONB)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_overdue_ms INT; v_overdue_tasks INT; v_missing INT; v_open_fb INT; v_overdue_fb INT;
  v_last_activity TIMESTAMPTZ; v_idle_days INT;
  v_members INT; v_total_pts NUMERIC; v_max_pts NUMERIC;
  pts_ms NUMERIC; pts_tasks NUMERIC; pts_docs NUMERIC; pts_fb NUMERIC; pts_idle NUMERIC; pts_imb NUMERIC;
  v_total NUMERIC; v_level TEXT; v_reasons TEXT[] := ARRAY[]::TEXT[];
BEGIN
  SELECT COUNT(*) INTO v_overdue_ms FROM milestones m
   WHERE m.project_id = p_project_id AND m.due_date < CURRENT_DATE AND m.status <> 'approved';

  SELECT COUNT(*) INTO v_overdue_tasks FROM tasks t JOIN milestones m ON m.milestone_id = t.milestone_id
   WHERE m.project_id = p_project_id AND t.due_date < CURRENT_DATE AND t.status NOT IN ('done','verified');

  SELECT COUNT(*) INTO v_missing FROM milestone_required_deliverables r
    JOIN milestones m ON m.milestone_id = r.milestone_id
   WHERE m.project_id = p_project_id AND m.due_date <= CURRENT_DATE + 7 AND m.status <> 'approved'
     AND NOT EXISTS (SELECT 1 FROM deliverables d WHERE d.milestone_id = m.milestone_id
                       AND d.deliverable_type = r.deliverable_type AND d.status IN ('submitted','accepted'));

  SELECT COUNT(*), COUNT(*) FILTER (WHERE f.due_date < CURRENT_DATE) INTO v_open_fb, v_overdue_fb
    FROM feedback_items f JOIN reviews rv ON rv.review_id = f.review_id
    JOIN milestones m ON m.milestone_id = rv.milestone_id
   WHERE m.project_id = p_project_id AND f.resolution_status <> 'verified';

  SELECT GREATEST(
     COALESCE((SELECT MAX(t.updated_at) FROM tasks t JOIN milestones m ON m.milestone_id = t.milestone_id
                WHERE m.project_id = p_project_id), '-infinity'::timestamptz),
     COALESCE((SELECT MAX(dv.uploaded_at) FROM document_versions dv
                JOIN deliverables d ON d.deliverable_id = dv.deliverable_id
                JOIN milestones m ON m.milestone_id = d.milestone_id
                WHERE m.project_id = p_project_id), '-infinity'::timestamptz),
     COALESCE((SELECT MAX(ce.created_at) FROM contribution_evidence ce
                WHERE ce.project_id = p_project_id), '-infinity'::timestamptz))
    INTO v_last_activity;
  v_idle_days := CASE WHEN v_last_activity = '-infinity'::timestamptz THEN 30
                      ELSE CURRENT_DATE - v_last_activity::date END;

  SELECT COUNT(*) INTO v_members FROM team_members tm JOIN projects p ON p.team_id = tm.team_id
   WHERE p.project_id = p_project_id;
  SELECT COALESCE(SUM(evidence_points), 0), COALESCE(MAX(evidence_points), 0)
    INTO v_total_pts, v_max_pts FROM v_contribution_summary WHERE project_id = p_project_id;

  -- Points per factor (max 25 + 20 + 20 + 15 + 10 + 10 = 100)
  pts_ms    := LEAST(25, v_overdue_ms * 12.5);
  pts_tasks := LEAST(20, v_overdue_tasks * 4);
  pts_docs  := LEAST(20, v_missing * 10);
  pts_fb    := LEAST(15, v_open_fb * 3 + v_overdue_fb * 2);
  pts_idle  := CASE WHEN v_idle_days <= 5 THEN 0 WHEN v_idle_days <= 10 THEN 5 ELSE 10 END;
  pts_imb   := CASE WHEN v_members >= 2 AND v_total_pts >= 5
                    THEN ROUND(10 * GREATEST(0, (v_max_pts / v_total_pts - 1.0 / v_members)
                                              / (1 - 1.0 / v_members)), 2)
                    ELSE 0 END;
  v_total := LEAST(100, pts_ms + pts_tasks + pts_docs + pts_fb + pts_idle + pts_imb);
  v_level := CASE WHEN v_total < 25 THEN 'low' WHEN v_total < 50 THEN 'moderate'
                  WHEN v_total < 75 THEN 'high' ELSE 'critical' END;

  IF v_overdue_ms   > 0 THEN v_reasons := v_reasons || format('%s milestone(s) overdue (+%s)', v_overdue_ms, pts_ms); END IF;
  IF v_overdue_tasks> 0 THEN v_reasons := v_reasons || format('%s task(s) overdue (+%s)', v_overdue_tasks, pts_tasks); END IF;
  IF v_missing      > 0 THEN v_reasons := v_reasons || format('%s mandatory deliverable(s) missing (+%s)', v_missing, pts_docs); END IF;
  IF v_open_fb      > 0 THEN v_reasons := v_reasons || format('%s unresolved feedback item(s), %s overdue (+%s)', v_open_fb, v_overdue_fb, pts_fb); END IF;
  IF pts_idle       > 0 THEN v_reasons := v_reasons || format('no recorded activity for %s days (+%s)', v_idle_days, pts_idle); END IF;
  IF pts_imb        > 0 THEN v_reasons := v_reasons || format('uneven contribution across members (+%s)', pts_imb); END IF;

  RETURN QUERY SELECT v_total, v_level,
      COALESCE(NULLIF(array_to_string(v_reasons, '; '), ''), 'No risk factors detected'),
      jsonb_build_object('overdue_milestones', pts_ms, 'overdue_tasks', pts_tasks,
                         'missing_deliverables', pts_docs, 'unresolved_feedback', pts_fb,
                         'inactivity', pts_idle, 'contribution_imbalance', pts_imb);
END $$;

-- Flag overdue milestones (time-based; Postgres cannot fire a trigger just because time passed,
-- so this runs from the sweep job and from the milestone trigger).
CREATE OR REPLACE FUNCTION fn_flag_overdue_milestones() RETURNS INT
LANGUAGE plpgsql AS $$
DECLARE v_count INT;
BEGIN
  INSERT INTO risk_events(project_id, milestone_id, event_type, details)
  SELECT m.project_id, m.milestone_id, 'milestone_overdue',
         format('Milestone "%s" was due on %s', m.title, m.due_date)
  FROM milestones m JOIN projects p ON p.project_id = m.project_id
  WHERE m.due_date < CURRENT_DATE AND m.status <> 'approved' AND p.status IN ('approved','in_progress')
  ON CONFLICT DO NOTHING;                       -- uq_open_risk_event prevents duplicates
  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE risk_events e SET resolved_at = now()
    FROM milestones m
   WHERE e.milestone_id = m.milestone_id AND e.event_type = 'milestone_overdue'
     AND e.resolved_at IS NULL AND m.status = 'approved';
  RETURN v_count;
END $$;

-- Store a new risk snapshot for one project (called by API, sweep script and after key events)
CREATE OR REPLACE PROCEDURE sp_recalculate_risk(p_project_id INT)
LANGUAGE plpgsql AS $$
DECLARE r RECORD;
BEGIN
  SELECT * INTO r FROM fn_calculate_project_risk(p_project_id);
  INSERT INTO risk_assessments(project_id, risk_score, risk_level, reason, breakdown)
  VALUES (p_project_id, r.risk_score, r.risk_level, r.reason, r.breakdown);
END $$;

-- Recalculate every active project. The Node sweep script instead loops over project ids and
-- calls sp_recalculate_risk one by one so it can draw a progress bar.
CREATE OR REPLACE PROCEDURE sp_run_risk_sweep()
LANGUAGE plpgsql AS $$
DECLARE v_id INT;
BEGIN
  PERFORM fn_flag_overdue_milestones();
  FOR v_id IN SELECT project_id FROM projects WHERE status IN ('approved','in_progress') LOOP
    CALL sp_recalculate_risk(v_id);
  END LOOP;
END $$;
```

### 9.3 Triggers — migration 010 `[PROPOSAL §14]`

Triggers required by the proposal: **audit entries on status changes** and **flag/create risk events when milestones become overdue**. The rest are integrity triggers that back up the validation rules.

| Trigger / function | Table(s) | Event | Purpose |
|---|---|---|---|
| `fn_validate_transition` | projects, milestones, tasks, feedback_items, deliverables, similarity_reviews | BEFORE UPDATE OF status column | Reject any status change not listed in `status_transitions` |
| `fn_audit_status_change` | same tables + reviews(decision) | AFTER UPDATE OF status column | Write `STATUS_CHANGE` row to `audit_logs` (who, old → new) |
| `fn_audit_row` | user_roles, guide_allocations, team_members, task_assignments, deliverables, tasks | AFTER INSERT/UPDATE/DELETE | Generic audit incl. DELETEs |
| `fn_block_modify_immutable` | proposal_actions, audit_logs | BEFORE UPDATE OR DELETE | Raise exception → history is immutable |
| `fn_check_weightage_total` | milestones | AFTER INSERT/UPDATE (constraint trigger, deferrable) | Sum of weightage per project ≤ 100 |
| `fn_check_team_member_is_student` | team_members | BEFORE INSERT/UPDATE | User must hold role `student` |
| `fn_check_allocation_role` | guide_allocations | BEFORE INSERT/UPDATE | User must hold matching role and must **not** be a member of that project's team |
| `fn_check_assignee_in_team` | task_assignments, feedback_items | BEFORE INSERT/UPDATE | Assignee must be a member of the project's team |
| `fn_auto_version_number` | document_versions | BEFORE INSERT | `version_number = max + 1` when not supplied |
| `fn_task_side_effects` | tasks | BEFORE UPDATE | Set/clear `actual_completion_date`, `verified_at` |
| `fn_evidence_from_task` | tasks | AFTER UPDATE OF status | On `verified` insert verified `task_completed` evidence for each assignee |
| `fn_evidence_from_docversion` | document_versions | AFTER INSERT | Insert unverified `document_upload` evidence for uploader |
| `fn_evidence_from_feedback` | feedback_items | AFTER UPDATE OF resolution_status | On `resolved` insert unverified `feedback_resolved` evidence; on `verified` mark it verified |
| `fn_block_approval_without_evidence` | milestones | BEFORE UPDATE OF status | Cannot move to `approved` while a mandatory deliverable type is missing (and, after migration 011, while `required_evidence_type` is unmet) |
| `fn_milestone_overdue_event` | milestones | AFTER INSERT OR UPDATE OF due_date, status | If `due_date < CURRENT_DATE` and not approved → insert `risk_events` row (`milestone_overdue`); resolve it when approved |

Reference implementations (write the rest in the same style):

```sql
-- 010_triggers.sql (excerpt)
SET search_path = projectpulse, public;

-- Generic transition guard. Usage: EXECUTE FUNCTION fn_validate_transition('status','project')
CREATE OR REPLACE FUNCTION fn_validate_transition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_col TEXT := TG_ARGV[0]; v_entity TEXT := TG_ARGV[1]; v_old TEXT; v_new TEXT;
BEGIN
  v_old := to_jsonb(OLD) ->> v_col;
  v_new := to_jsonb(NEW) ->> v_col;
  IF v_old IS DISTINCT FROM v_new AND NOT EXISTS (
       SELECT 1 FROM status_transitions
        WHERE entity_type = v_entity AND from_status = v_old AND to_status = v_new) THEN
    RAISE EXCEPTION 'Invalid % status change: % -> %', v_entity, v_old, v_new
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_projects_transition BEFORE UPDATE OF status ON projects
  FOR EACH ROW EXECUTE FUNCTION fn_validate_transition('status','project');
CREATE TRIGGER trg_milestones_transition BEFORE UPDATE OF status ON milestones
  FOR EACH ROW EXECUTE FUNCTION fn_validate_transition('status','milestone');
CREATE TRIGGER trg_tasks_transition BEFORE UPDATE OF status ON tasks
  FOR EACH ROW EXECUTE FUNCTION fn_validate_transition('status','task');
CREATE TRIGGER trg_feedback_transition BEFORE UPDATE OF resolution_status ON feedback_items
  FOR EACH ROW EXECUTE FUNCTION fn_validate_transition('resolution_status','feedback');
CREATE TRIGGER trg_deliverables_transition BEFORE UPDATE OF status ON deliverables
  FOR EACH ROW EXECUTE FUNCTION fn_validate_transition('status','deliverable');
CREATE TRIGGER trg_similarity_transition BEFORE UPDATE OF faculty_decision ON similarity_reviews
  FOR EACH ROW EXECUTE FUNCTION fn_validate_transition('faculty_decision','similarity');

-- Audit of status changes. Usage: fn_audit_status_change('<pk column>','<status column>')
CREATE OR REPLACE FUNCTION fn_audit_status_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_user INT := NULLIF(current_setting('app.current_user_id', true), '')::INT;
  v_pk TEXT := to_jsonb(NEW) ->> TG_ARGV[0];
  v_old TEXT := to_jsonb(OLD) ->> TG_ARGV[1];
  v_new TEXT := to_jsonb(NEW) ->> TG_ARGV[1];
BEGIN
  IF v_old IS DISTINCT FROM v_new THEN
    INSERT INTO audit_logs(user_id, action, entity_type, entity_id, old_values, new_values)
    VALUES (v_user, 'STATUS_CHANGE', TG_TABLE_NAME, v_pk,
            jsonb_build_object(TG_ARGV[1], v_old), jsonb_build_object(TG_ARGV[1], v_new));
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_projects_audit AFTER UPDATE OF status ON projects
  FOR EACH ROW EXECUTE FUNCTION fn_audit_status_change('project_id','status');
-- repeat for milestones (milestone_id,status), tasks (task_id,status),
-- feedback_items (feedback_id,resolution_status), deliverables (deliverable_id,status),
-- similarity_reviews (similarity_id,faculty_decision), reviews (review_id,decision)

-- Generic row audit (INSERT/UPDATE/DELETE with old/new JSON)
CREATE OR REPLACE FUNCTION fn_audit_row() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_user INT := NULLIF(current_setting('app.current_user_id', true), '')::INT;
  v_old JSONB; v_new JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN v_new := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN v_old := to_jsonb(OLD); v_new := to_jsonb(NEW);
  ELSE v_old := to_jsonb(OLD); END IF;
  INSERT INTO audit_logs(user_id, action, entity_type, entity_id, old_values, new_values)
  VALUES (v_user, TG_OP, TG_TABLE_NAME, COALESCE(v_new, v_old) ->> TG_ARGV[0], v_old, v_new);
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER trg_deliverables_row_audit AFTER INSERT OR UPDATE OR DELETE ON deliverables
  FOR EACH ROW EXECUTE FUNCTION fn_audit_row('deliverable_id');
CREATE TRIGGER trg_task_assign_audit AFTER INSERT OR DELETE ON task_assignments
  FOR EACH ROW EXECUTE FUNCTION fn_audit_row('task_id');

-- Immutability
CREATE OR REPLACE FUNCTION fn_block_modify_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION '% is append-only; % is not allowed', TG_TABLE_NAME, TG_OP;
END $$;
CREATE TRIGGER trg_proposal_actions_immutable BEFORE UPDATE OR DELETE ON proposal_actions
  FOR EACH ROW EXECUTE FUNCTION fn_block_modify_immutable();
CREATE TRIGGER trg_audit_logs_immutable BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION fn_block_modify_immutable();

-- Milestone weightage total <= 100 per project
CREATE OR REPLACE FUNCTION fn_check_weightage_total() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_total NUMERIC;
BEGIN
  SELECT COALESCE(SUM(weightage), 0) INTO v_total FROM milestones WHERE project_id = NEW.project_id;
  IF v_total > 100 THEN
    RAISE EXCEPTION 'Total milestone weightage for project % is % (max 100)', NEW.project_id, v_total
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER trg_milestone_weightage AFTER INSERT OR UPDATE OF weightage ON milestones
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fn_check_weightage_total();

-- Auto version numbers
CREATE OR REPLACE FUNCTION fn_auto_version_number() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.version_number IS NULL THEN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO NEW.version_number
      FROM document_versions WHERE deliverable_id = NEW.deliverable_id;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_docver_number BEFORE INSERT ON document_versions
  FOR EACH ROW EXECUTE FUNCTION fn_auto_version_number();
-- NOTE: version_number is declared NOT NULL; NOT NULL is checked AFTER BEFORE-triggers run,
-- so omitting the column in INSERT works.

-- Overdue milestone -> risk event (the proposal's required trigger)
CREATE OR REPLACE FUNCTION fn_milestone_overdue_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.due_date < CURRENT_DATE AND NEW.status <> 'approved' THEN
    INSERT INTO risk_events(project_id, milestone_id, event_type, details)
    VALUES (NEW.project_id, NEW.milestone_id, 'milestone_overdue',
            format('Milestone "%s" was due on %s', NEW.title, NEW.due_date))
    ON CONFLICT DO NOTHING;
  ELSIF NEW.status = 'approved' THEN
    UPDATE risk_events SET resolved_at = now()
     WHERE milestone_id = NEW.milestone_id AND event_type = 'milestone_overdue' AND resolved_at IS NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_milestone_overdue AFTER INSERT OR UPDATE OF due_date, status ON milestones
  FOR EACH ROW EXECUTE FUNCTION fn_milestone_overdue_event();

-- Task side effects + automatic contribution evidence
CREATE OR REPLACE FUNCTION fn_task_side_effects() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('done','verified') AND NEW.actual_completion_date IS NULL THEN
    NEW.actual_completion_date := CURRENT_DATE;
  ELSIF NEW.status NOT IN ('done','verified') THEN
    NEW.actual_completion_date := NULL; NEW.verified_by := NULL; NEW.verified_at := NULL;
  END IF;
  IF NEW.status = 'verified' AND NEW.verified_at IS NULL THEN NEW.verified_at := now(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_tasks_side_effects BEFORE UPDATE OF status ON tasks
  FOR EACH ROW EXECUTE FUNCTION fn_task_side_effects();

CREATE OR REPLACE FUNCTION fn_evidence_from_task() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'verified' AND OLD.status IS DISTINCT FROM 'verified' THEN
    INSERT INTO contribution_evidence(project_id, user_id, task_id, evidence_type, description,
                                      weight, verified_flag, verified_by, verified_at, source_table, source_id)
    SELECT m.project_id, ta.user_id, NEW.task_id, 'task_completed',
           'Verified task: ' || NEW.title,
           LEAST(10, GREATEST(1, ROUND(NEW.effort_hours / 4.0, 2))),   -- bigger task, more weight
           TRUE, NEW.verified_by, NEW.verified_at, 'tasks', NEW.task_id
      FROM task_assignments ta JOIN milestones m ON m.milestone_id = NEW.milestone_id
     WHERE ta.task_id = NEW.task_id
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_task_evidence AFTER UPDATE OF status ON tasks
  FOR EACH ROW EXECUTE FUNCTION fn_evidence_from_task();
```

Write the remaining triggers (`fn_check_*`, `fn_evidence_from_docversion`, `fn_evidence_from_feedback`, `fn_block_approval_without_evidence`) in the same style. After migration 011 (ALTER), `CREATE OR REPLACE` `fn_block_approval_without_evidence` so it also requires an accepted/submitted deliverable of `NEW.required_evidence_type` when that column is not null.

**Deferred/ordering note:** seed scripts insert historical data (past due dates, verified tasks). Run the seed with `SET session_replication_role = replica` **only** for the bulk seed transaction, or insert in a valid order and temporarily use `ALTER TABLE … DISABLE TRIGGER` for transition triggers; re-enable afterward. Prefer inserting in valid order so the triggers are exercised.

### 9.4 Contribution evidence flow (end to end)

1. Student completes a task → status `done` (no evidence yet).
2. Guide verifies it → status `verified` → trigger inserts **verified** `task_completed` evidence for each assignee.
3. Student uploads a document version → trigger inserts **unverified** `document_upload` evidence → guide verifies it in the "Evidence queue" UI (sets `verified_flag`, `verified_by`, `verified_at`).
4. Student resolves a feedback item → unverified `feedback_resolved` evidence; becomes verified when the guide verifies the feedback item.
5. Git activity entered manually → unverified `git_activity` evidence (cap: at most 5 counted per member per milestone).
6. Only `verified_flag = TRUE` evidence counts in `v_contribution_summary` and in the risk imbalance factor.

### 9.5 Transactions `[PROPOSAL §14]` — atomic milestone submission

**Rule:** deliverable metadata, document version, milestone status update, review request and audit log either **all succeed or all roll back.**

Route Handler `POST /api/milestones/:id/submit` runs this inside one connection/transaction (`withTransaction` helper in `lib/db/pg.ts`):

```
BEGIN;
SET LOCAL app.current_user_id = '<session user>';
1. SELECT … FROM milestones WHERE milestone_id = $1 FOR UPDATE;      -- lock; stops double submit
   -- verify: user is a member of the project's team; status IN ('in_progress','revision_requested')
2. INSERT INTO deliverables(…) VALUES (…) RETURNING deliverable_id;   -- status 'submitted'
3. INSERT INTO document_versions(deliverable_id, change_summary, …);  -- version_number set by trigger
4. UPDATE milestones SET status = 'submitted', submitted_at = now() WHERE milestone_id = $1;
5. INSERT INTO reviews(milestone_id, reviewer_id, review_type, decision)   -- the review request
        SELECT $1, user_id, 'milestone', 'pending' FROM guide_allocations WHERE project_id = … ;
6. INSERT INTO audit_logs(user_id, action, entity_type, entity_id, new_values)
        VALUES ($user, 'MILESTONE_SUBMITTED', 'milestone', $1, '{…}');
COMMIT;      -- any error at any step → ROLLBACK; nothing is partially saved
```

MongoDB step (outside PostgreSQL's transaction): insert the document with `state: "pending"` **before** `BEGIN`; after `COMMIT` set `state: "confirmed"`; after `ROLLBACK` delete the pending document (compensation, see §7).

Other transactional operations: proposal decision (update `projects.status` + insert `proposal_actions` + audit), guide verification of evidence, team creation with members, applying a template (milestones + required deliverables in one transaction).

**Test case for rollback (required in the demo):** call the submit endpoint with a deliberately invalid version payload (for example negative `file_size_bytes`) so step 3 violates a CHECK. Then show that (a) no `deliverables` row exists, (b) milestone status is unchanged, (c) no audit row was written, (d) the Mongo pending document was removed. A test-only hook (`x-test-fail-at` header honoured only when `NODE_ENV=test`) may be used to fail at step 5 or 6 as well.

### 9.6 Formulas `[ASSUMED]` — make these visible in the UI ("How is this calculated?")

**Risk score (0–100)** — sum of six factors, each capped:

| Factor | Points | Cap |
|---|---|---|
| Overdue (unapproved, past due) milestones | 12.5 each | 25 |
| Overdue tasks (past due, not done/verified) | 4 each | 20 |
| Missing mandatory deliverable types (milestone due ≤ 7 days or overdue) | 10 each | 20 |
| Unresolved feedback (3 per open item + 2 extra per overdue item) | — | 15 |
| Inactivity (no task update, document upload or evidence): ≤5 days 0; 6–10 days 5; >10 days 10 | — | 10 |
| Contribution imbalance: `10 × max(0, (max_share − 1/n) / (1 − 1/n))`, only if team has ≥ 2 members and ≥ 5 verified points | — | 10 |

Level: **low** 0–24.99, **moderate** 25–49.99, **high** 50–74.99, **critical** 75–100. The `reason` text lists every factor that scored points, and `breakdown` JSON stores the per-factor points. This is *explainable*: faculty always see why.

**Contribution indicator (0–100) per member:** `0.8 × evidence_share + 0.2 × peer_share`, where `evidence_share` is the member's verified weighted evidence points ÷ team total × 100 (type multipliers: task_completed 3, document_upload 2, feedback_resolved 2, review_participation 1, git_activity 1, each × the evidence `weight`) and `peer_share` is the member's average peer score ÷ sum of the team's average peer scores × 100 (falls back to `evidence_share` if no peer evaluations exist). It is an *indicator for faculty*, not a grade.

**Milestone completion %:** effort-weighted done/verified tasks ÷ total effort; approved milestone = 100. **Project progress %:** `Σ(weightage × completion) ÷ Σ(weightage)`.

**Documentation completeness %:** required deliverable types with a submitted/accepted deliverable ÷ total required types for milestones due within 7 days or earlier.

### 9.7 Workflow state machines `[ASSUMED]` (enforced by `status_transitions` + trigger)

| Entity | Allowed transitions |
|---|---|
| Project / proposal | draft → submitted → (approved \| rejected \| revision_requested); revision_requested → submitted; approved → in_progress → completed → archived; rejected → archived |
| Milestone | planned → in_progress → submitted → under_review → (approved \| revision_requested \| rejected); revision_requested → in_progress; rejected → in_progress |
| Task | todo → in_progress ↔ blocked; in_progress → done → verified; done → in_progress (reopen) |
| Feedback item | open → in_progress → resolved → (verified \| reopened); open → resolved; reopened → in_progress \| resolved |
| Deliverable | draft → submitted → (accepted \| rejected); rejected → draft |
| Similarity decision | pending → (not_similar \| acceptable_overlap \| needs_revision \| escalated); escalated → (not_similar \| acceptable_overlap \| needs_revision) |

Who may trigger each transition is decided in the API (e.g. only the guide: `verified`, `approved`; only the assigned student: `resolved`), and the DB guards that the *transition itself* is legal.

---

## 10. DML and important queries `[PROPOSAL §13]` `[GUIDELINE #6]`

All queries live in `db/queries/important_queries.sql` (runnable, with comments) and are called from Route Handlers with parameters. Use `$1…` placeholders, never string concatenation.

### 10.1 Operations matrix

| Operation | Concept demonstrated | Endpoint(s) |
|---|---|---|
| Create proposal, milestone, task, deliverable, feedback, evidence records | INSERT with validation and FK integrity | `POST /api/proposals`, `/milestones`, `/tasks`, `/deliverables`, `/feedback`, `/evidence` |
| Update task status, feedback resolution, milestone approval, project status | UPDATE with controlled workflow transitions | `PATCH …/status` routes |
| Remove an incorrect draft deliverable or task assignment | DELETE with authorization and audit logging | `DELETE /api/deliverables/:id` (draft only), `DELETE /api/tasks/:id/assignments/:userId` |
| List high-risk projects by guide/course | JOIN, ORDER BY, view, aggregate | `GET /api/dashboard/risk` |
| Teams with more than a threshold of overdue tasks | JOIN, GROUP BY, HAVING, date calculations | `GET /api/reports/delayed-teams?min=3` |
| Compare verified contribution evidence among team members | JOIN, aggregate functions, conditional aggregation | `GET /api/projects/:id/contribution` |
| Milestones with unresolved feedback | Subquery / NOT EXISTS or LEFT JOIN with status filter | `GET /api/reports/unresolved-feedback` |
| Projects lacking mandatory deliverable types | Subqueries, anti-join, GROUP BY/HAVING | `GET /api/reports/missing-deliverables` |
| Retrieve similar project proposals | pgvector cosine-distance query with metadata filters | `POST /api/similarity/search` |

### 10.2 Query catalogue (write all of these; adjust names to the final schema)

```sql
-- Q1 High-risk projects for a guide (view + JOIN + ORDER BY)
SELECT d.project_id, d.title, d.team_name, d.course_name, d.risk_score, d.risk_level, d.reason, d.days_to_next_deadline
FROM v_faculty_risk_dashboard d
WHERE d.guide_id = $1 AND d.risk_level IN ('high','critical')
ORDER BY d.risk_score DESC, d.days_to_next_deadline ASC;

-- Q2 Teams with more than N overdue tasks (JOIN + GROUP BY + HAVING + date calc)
SELECT t.team_id, t.team_name, COUNT(*) AS overdue_tasks, MAX(CURRENT_DATE - tk.due_date) AS max_days_late
FROM tasks tk
JOIN milestones m ON m.milestone_id = tk.milestone_id
JOIN projects p   ON p.project_id = m.project_id
JOIN teams t      ON t.team_id = p.team_id
WHERE tk.due_date < CURRENT_DATE AND tk.status NOT IN ('done','verified')
GROUP BY t.team_id, t.team_name
HAVING COUNT(*) > $1
ORDER BY overdue_tasks DESC;

-- Q3 Contribution comparison inside a team (conditional aggregation)
SELECT u.name,
       COUNT(*) FILTER (WHERE ce.evidence_type = 'task_completed' AND ce.verified_flag)    AS tasks_verified,
       COUNT(*) FILTER (WHERE ce.evidence_type = 'document_upload' AND ce.verified_flag)   AS docs,
       COUNT(*) FILTER (WHERE ce.evidence_type = 'feedback_resolved' AND ce.verified_flag) AS feedback_resolved,
       SUM(ce.weight) FILTER (WHERE ce.verified_flag)                                       AS weighted_points
FROM team_members tm
JOIN projects p ON p.team_id = tm.team_id
JOIN users u ON u.user_id = tm.user_id
LEFT JOIN contribution_evidence ce ON ce.project_id = p.project_id AND ce.user_id = tm.user_id
WHERE p.project_id = $1
GROUP BY u.user_id, u.name
ORDER BY weighted_points DESC NULLS LAST;

-- Q4 Milestones that still have unresolved feedback (NOT EXISTS form: milestones that are FULLY clean)
SELECT m.milestone_id, m.title, COUNT(f.feedback_id) AS open_items
FROM milestones m
JOIN reviews r ON r.milestone_id = m.milestone_id
JOIN feedback_items f ON f.review_id = r.review_id
WHERE m.project_id = $1 AND f.resolution_status <> 'verified'
GROUP BY m.milestone_id, m.title;
--     …and the anti-join form: approved milestones that have NO unresolved feedback
SELECT m.* FROM milestones m
WHERE m.status = 'approved' AND NOT EXISTS (
  SELECT 1 FROM reviews r JOIN feedback_items f ON f.review_id = r.review_id
  WHERE r.milestone_id = m.milestone_id AND f.resolution_status <> 'verified');

-- Q5 Projects lacking mandatory deliverable types (anti-join + GROUP BY/HAVING)
SELECT p.project_id, p.title, COUNT(*) AS missing_types
FROM projects p
JOIN milestones m ON m.project_id = p.project_id
JOIN milestone_required_deliverables r ON r.milestone_id = m.milestone_id
LEFT JOIN deliverables d ON d.milestone_id = m.milestone_id
      AND d.deliverable_type = r.deliverable_type AND d.status IN ('submitted','accepted')
WHERE d.deliverable_id IS NULL AND m.due_date <= CURRENT_DATE + 7
GROUP BY p.project_id, p.title
HAVING COUNT(*) >= 1
ORDER BY missing_types DESC;

-- Q6 Similar proposals (pgvector; see §12 for the full flow)
SELECT p.project_id, p.title, e.section_type, e.chunk_text,
       1 - (e.embedding <=> $1::vector) AS cosine_similarity
FROM project_embeddings e
JOIN projects p ON p.project_id = e.project_id
WHERE e.is_current AND e.course_id = $2 AND e.project_id <> $3
ORDER BY e.embedding <=> $1::vector
LIMIT $4;

-- Q7 Latest risk per project (window function / DISTINCT ON)
SELECT DISTINCT ON (project_id) project_id, risk_score, risk_level, calculated_at
FROM risk_assessments ORDER BY project_id, calculated_at DESC;

-- Q8 Risk trend for one project (chart data)
SELECT calculated_at::date AS day, MAX(risk_score) AS score FROM risk_assessments
WHERE project_id = $1 GROUP BY 1 ORDER BY 1;

-- Q9 Guide workload (JOIN + GROUP BY + aggregate)
SELECT u.name, COUNT(DISTINCT ga.project_id) AS projects,
       COUNT(DISTINCT ga.project_id) FILTER (WHERE lr.risk_level IN ('high','critical')) AS high_risk
FROM guide_allocations ga JOIN users u ON u.user_id = ga.user_id
LEFT JOIN v_faculty_risk_dashboard lr ON lr.project_id = ga.project_id
WHERE ga.allocation_role = 'guide' GROUP BY u.user_id, u.name ORDER BY projects DESC;

-- Q10 Unapproved milestones past due, by course (JOIN + date calc)
SELECT c.course_name, t.team_name, m.title, m.due_date, CURRENT_DATE - m.due_date AS days_overdue
FROM milestones m JOIN projects p ON p.project_id = m.project_id
JOIN teams t ON t.team_id = p.team_id JOIN courses c ON c.course_id = p.course_id
WHERE m.status <> 'approved' AND m.due_date < CURRENT_DATE ORDER BY days_overdue DESC;

-- Q11 Students with the most open feedback assigned (subquery in HAVING)
SELECT u.name, COUNT(*) AS open_items FROM feedback_items f JOIN users u ON u.user_id = f.assigned_user_id
WHERE f.resolution_status IN ('open','in_progress','reopened')
GROUP BY u.user_id, u.name
HAVING COUNT(*) > (SELECT AVG(c) FROM (SELECT COUNT(*) c FROM feedback_items
                                       WHERE resolution_status IN ('open','in_progress','reopened')
                                       GROUP BY assigned_user_id) s);

-- Q12 Full-text search over proposals (advanced feature: full-text search)
SELECT project_id, title, ts_rank(to_tsvector('english', title||' '||coalesce(abstract,'')), q) AS rank
FROM projects, plainto_tsquery('english', $1) q
WHERE to_tsvector('english', title||' '||coalesce(abstract,'')) @@ q ORDER BY rank DESC;

-- Q13 Feedback turnaround time per guide (aggregate, interval math)
SELECT cu.name AS guide, COUNT(*) AS items, ROUND(AVG(EXTRACT(EPOCH FROM (f.resolved_at - f.created_at))/86400)::numeric, 1) AS avg_days_to_resolve
FROM feedback_items f JOIN users cu ON cu.user_id = f.created_by
WHERE f.resolved_at IS NOT NULL GROUP BY cu.user_id, cu.name;

-- Q14 Projects whose risk got worse since last week (self-join on snapshots)
SELECT n.project_id, o.risk_score AS last_week, n.risk_score AS now
FROM (SELECT DISTINCT ON (project_id) * FROM risk_assessments ORDER BY project_id, calculated_at DESC) n
JOIN (SELECT DISTINCT ON (project_id) * FROM risk_assessments WHERE calculated_at < now() - interval '7 days'
      ORDER BY project_id, calculated_at DESC) o USING (project_id)
WHERE n.risk_score > o.risk_score;
```

Also include one **negative demonstration per DML type** in `db/tests/` (an INSERT that violates an FK, an UPDATE with an illegal transition, a DELETE blocked by `ON DELETE RESTRICT`).

---

## 11. NoSQL component — MongoDB `[PROPOSAL §10]` `[GUIDELINE #4]`

MongoDB holds flexible document-oriented records. A document can represent an uploaded academic artefact and its extracted structured sections. Different milestone documents need different fields, which is why this is not forced into SQL columns.

### 11.1 Collections

| Collection | Purpose | Key fields |
|---|---|---|
| `documents` `[PROPOSAL]` | One document per deliverable (SRS, report, design doc, test report…) with its versions and extracted sections | `projectId`, `milestoneId`, `deliverableId`, `documentType`, `title`, `versions[]`, `sections{}`, `tags[]`, `extractedText`, `state` |
| `feedback_threads` `[PROPOSAL]` | Discussion thread per feedback item | `feedbackId`, `projectId`, `milestoneId`, `theme`, `status`, `messages[{authorId, role, text, at}]` |
| `meeting_notes` `[PROPOSAL]` | Guide meeting notes | `projectId`, `date`, `attendees[]`, `notes`, `actionItems[{text, ownerId, done}]` |
| `attachments` `[ASSUMED]` | Screenshots/evidence files metadata | `projectId`, `deliverableId`, `fileName`, `mimeType`, `sizeBytes`, `storagePath`, `uploadedBy`, `uploadedAt` |

### 11.2 Document model (from the proposal)

```json
{
  "projectId": 1042,
  "milestoneId": 215,
  "documentType": "SRS",
  "title": "Software Requirements Specification",
  "versions": [
    { "versionNumber": 1, "uploadedBy": 501, "uploadedAt": "timestamp",
      "fileUrl": "secure-url", "changeSummary": "Initial submission" }
  ],
  "sections": { "problemStatement": "...", "objectives": ["..."], "scope": "..." },
  "tags": ["DBMS", "Next.js", "PostgreSQL"]
}
```

Additional fields `[ADDED]`: `deliverableId` (link to the PostgreSQL deliverable), `state` (`pending` | `confirmed`, see §7), `extractedText` (text pulled from the file when it is `.txt`/`.md`; PDF text extraction is optional P2; OCR is out of scope), `wordCount`, `createdAt`. `uploadedBy` and IDs are PostgreSQL integer IDs.

`$jsonSchema` validator on `documents` (apply with `collMod`/`createCollection` in `db/mongo/collections.js`): require `projectId`, `milestoneId`, `documentType` (enum: `SRS`, `Design`, `Report`, `TestReport`, `Presentation`, `Proposal`, `Other`), `title`, `versions` (array, min 1, each with integer `versionNumber ≥ 1`, `uploadedBy`, `uploadedAt`, `changeSummary` string), `tags` (array of strings). `sections` is free-form on purpose.

### 11.3 Indexes `[PROPOSAL]`

```js
db.documents.createIndex({ projectId: 1, milestoneId: 1 });
db.documents.createIndex({ documentType: 1 });
db.documents.createIndex({ "versions.uploadedAt": -1 });
db.documents.createIndex({ tags: 1 });
db.documents.createIndex({ title: "text", extractedText: "text", "sections.problemStatement": "text" }); // text search
db.feedback_threads.createIndex({ projectId: 1, status: 1 });
db.feedback_threads.createIndex({ feedbackId: 1 }, { unique: true });
db.meeting_notes.createIndex({ projectId: 1, date: -1 });
```

### 11.4 Aggregation pipelines `[PROPOSAL §10, §14]`

The proposal requires aggregation to calculate **document completeness, version counts, document-type distribution, and unresolved feedback themes**. Implement them as API-backed pipelines (and keep the code in `db/mongo/aggregations.js`).

```js
// A1 Version counts per document for a project
db.documents.aggregate([
  { $match: { projectId: 1042, state: "confirmed" } },
  { $project: { title: 1, documentType: 1, versionCount: { $size: "$versions" },
                lastUpdated: { $max: "$versions.uploadedAt" } } },
  { $sort: { versionCount: -1 } }
]);

// A2 Document-type distribution across a course (join project ids from PostgreSQL first, pass as $in)
db.documents.aggregate([
  { $match: { projectId: { $in: [/* ids from SQL */] }, state: "confirmed" } },
  { $group: { _id: "$documentType", documents: { $sum: 1 }, avgVersions: { $avg: { $size: "$versions" } } } },
  { $sort: { documents: -1 } }
]);

// A3 Required-document completion per project:
//    SQL returns the required types for the project; Mongo returns which types exist; the API
//    merges them → completeness % (and compare with SQL fn_documentation_completeness).
db.documents.aggregate([
  { $match: { projectId: 1042, state: "confirmed" } },
  { $group: { _id: "$documentType", versions: { $sum: { $size: "$versions" } } } }
]);

// A4 Unresolved feedback themes (most common themes among open threads)
db.feedback_threads.aggregate([
  { $match: { projectId: { $in: [/* ids */] }, status: { $in: ["open", "in_progress", "reopened"] } } },
  { $group: { _id: "$theme", openThreads: { $sum: 1 }, avgMessages: { $avg: { $size: "$messages" } } } },
  { $sort: { openThreads: -1 } }, { $limit: 10 }
]);

// A5 Most-used technology tags (tags array → $unwind)
db.documents.aggregate([{ $unwind: "$tags" }, { $group: { _id: "$tags", n: { $sum: 1 } } }, { $sort: { n: -1 } }]);
```
`theme` on a feedback thread is set by the guide from a fixed list (`documentation`, `requirements`, `design`, `implementation`, `testing`, `presentation`, `other`) — no NLP needed.

---

## 12. Vector database and semantic search — PostgreSQL + pgvector `[PROPOSAL §11]` `[GUIDELINE #8]`

The guidelines ask the team to explain: what is embedded, which model, how vectors are stored, which metric, how results are retrieved. All five are specified below.

| Requirement | Implementation decision |
|---|---|
| **What is embedded** | Project title, abstract, problem statement, objectives, scope, and approved selected text chunks from proposals/reports (`document_chunk`). One vector per section/chunk. |
| **Embedding model** | `Xenova/all-MiniLM-L6-v2` (sentence-transformer, 384 dimensions) run locally through `@huggingface/transformers` `[ASSUMED]`; the proposal allows "a sentence-transformer embedding model or approved embedding API, documented in the final implementation" — document the final choice in `docs/DECISIONS.md` and the report. Vectors are L2-normalised. |
| **Storage** | `project_embeddings` table: project/document reference, text chunk, embedding vector, section type, timestamps, and access metadata (`course_id`, `is_current`, `access_level`) — see §8.9. |
| **Similarity metric** | **Cosine similarity** (SQL operator `<=>` = cosine *distance*; `similarity = 1 − distance`). Index: HNSW with `vector_cosine_ops`. |
| **Retrieval strategy** | Embed a new proposal/query; filter by course/semester and access permissions; return top-k closest approved/current proposals above a review threshold; show matching text and score to faculty. |
| **Ethical control** | Similarity is a **review signal only**. A faculty member records the final decision; the platform never declares plagiarism. UI wording: "possible overlap", never "plagiarised/copied". |

### 12.1 Pipeline

1. **Embed on events:** when a proposal is submitted (and again when resubmitted), call `embedProject(projectId)`: build the six texts, embed each, and upsert into `project_embeddings` (`ON CONFLICT (project_id, section_type, chunk_index, model_name) DO UPDATE`). When a proposal is rejected/archived set `is_current = FALSE`.
2. **Long text:** split abstracts/documents into chunks of ~200 words with 30-word overlap (`chunk_index`).
3. **Search on submission:** `findSimilarProjects(projectId)` embeds each section of the new proposal and, for each, runs Q6 with the course filter, excluding the project itself. Results are grouped per matched project.
4. **Project-level score:** weighted mean of the best section-level similarity: title 0.15, abstract 0.30, problem statement 0.30, objectives 0.15, scope 0.10. A matched project is flagged when this score ≥ `SIMILARITY_THRESHOLD` (default **0.80**) **or** any single section ≥ 0.90. Keep top-k (`SIMILARITY_TOP_K`, default 5).
5. **Persist for review:** insert/update `similarity_reviews` (`faculty_decision = 'pending'`, score, best matching section, excerpts of both texts).
6. **Faculty review screen:** side-by-side excerpts, score per section, decision buttons (not similar / acceptable overlap / needs revision / escalate) and comments → updates `similarity_reviews`, writes audit log. **Faculty only.** Students never see other teams' text.
7. **Student hint `[ADDED]`:** on the proposal form the student can click "Check originality". The API runs the same search but returns only `{ possibleOverlap: true|false }` and the sentence "Your idea may overlap with an existing proposal. Faculty will review it." — no titles, no text, no scores.

Pre-download the model before the demo (first load needs internet). Set `hnsw.ef_search` to 100 for the demo session. Because the data set is small, an exact scan is also fine; keep the HNSW index to demonstrate the feature.

### 12.2 Required demo data for similarity
Seed two clearly overlapping proposals (e.g. "Campus Event Management Portal" vs "College Event Coordination Platform") plus unrelated ones, so the search visibly finds a high-score match and low scores for unrelated projects (§17).

---

## 13. Backend / API layer (Next.js Route Handlers) `[PROPOSAL §15]` `[GUIDELINE #10]`

Every handler: (1) authenticate the session, (2) authorise by **role and ownership**, (3) validate the body/query with Zod, (4) run parameterised SQL (in a transaction when more than one write), (5) return JSON with consistent errors `{ error: { code, message, fields? } }`, (6) never leak SQL errors to the client — map known Postgres error codes (`23505` unique, `23503` FK, `23514` check, `P0001`/raised exceptions) to friendly messages.

| Area | Method + path | Roles | Notes |
|---|---|---|---|
| Auth | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/change-password` | all | Lockout after 5 failures |
| Users (admin) | `GET/POST /api/admin/users`, `PATCH /api/admin/users/:id`, `POST /api/admin/users/:id/roles` | admin | Hash password with bcrypt |
| Academic setup | `GET/POST /api/admin/departments`, `/courses`, `/templates` (+ template milestones) | admin (R for others) | |
| Teams | `GET/POST /api/teams`, `POST /api/teams/:id/members`, `DELETE /api/teams/:id/members/:userId`, `PATCH …/responsibility` | admin; student leader (own team) | One team per course enforced by DB |
| Allocations | `POST/DELETE /api/projects/:id/allocations` | admin | Guide/reviewer rules via trigger |
| Proposals | `GET/POST /api/proposals`, `GET/PATCH /api/proposals/:id`, `POST /api/proposals/:id/submit` | student (own), guides, admin | |
| Proposal decision | `POST /api/proposals/:id/decision` `{action: approve|reject|request_revision, comments}` | faculty guide (assigned) | Transaction: status + `proposal_actions` + audit |
| Proposal history | `GET /api/proposals/:id/history` | team, guide, admin | |
| Milestones | `GET/POST /api/projects/:id/milestones`, `PATCH /api/milestones/:id`, `POST /api/projects/:id/apply-template` | student (own, plan), guide | |
| Milestone workflow | `POST /api/milestones/:id/start`, `/submit` (transaction §9.5), `/review-start`, `/decision` | student, guide/reviewer | |
| Tasks | `GET/POST /api/milestones/:id/tasks`, `PATCH /api/tasks/:id`, `POST /api/tasks/:id/status`, `POST/DELETE /api/tasks/:id/assignments` | student (own team), guide (verify) | |
| Deliverables | `GET/POST /api/milestones/:id/deliverables`, `POST /api/deliverables/:id/versions`, `DELETE /api/deliverables/:id` (draft only), `POST /api/deliverables/:id/decision` | student, guide | File upload via multipart |
| Files | `GET /api/files/:attachmentId` | authorised team/guide/admin | Streams from `storage/`; never a public URL |
| Reviews | `POST /api/milestones/:id/reviews`, `PATCH /api/reviews/:id` (scores, decision) | guide, reviewer | |
| Feedback | `POST /api/reviews/:id/feedback`, `POST /api/feedback/:id/respond`, `/resolve`, `/verify`, `/reopen`, `GET/POST /api/feedback/:id/thread` | guide/reviewer create; student respond; guide verify | Thread in MongoDB |
| Evidence | `GET /api/projects/:id/evidence`, `POST /api/evidence/:id/verify`, `POST /api/git-activities` | guide verify; student add git ref | |
| Peer evaluation | `POST /api/projects/:id/peer-evaluations`, `GET /api/projects/:id/peer-evaluations/summary` | student (give), guide (summary) | Anonymised for students |
| Contribution | `GET /api/projects/:id/contribution` | guide/admin all; student own row only | |
| Risk | `GET /api/projects/:id/risk`, `GET /api/projects/:id/risk/history`, `POST /api/projects/:id/risk/recalculate`, `POST /api/jobs/risk-sweep` | guide/admin; sweep: admin or `JOB_SECRET` | |
| Dashboards | `GET /api/dashboard/student`, `/guide`, `/reviewer`, `/admin` | per role | Use views |
| Reports | `GET /api/reports/delayed-teams`, `/unapproved-milestones`, `/unresolved-feedback`, `/missing-deliverables`, `/contribution-imbalance`, `/high-risk` (+ `?format=csv` P2) | guide (assigned), admin | Filters: course, guide, team, status |
| Documents (Mongo) | `GET /api/projects/:id/documents`, `/documents/stats` (aggregations A1–A4) | team, guide, admin | |
| Similarity | `POST /api/similarity/check` (student hint), `POST /api/similarity/search` (faculty free-text), `GET /api/similarity/reviews`, `POST /api/similarity/reviews/:id/decision` | student (hint only), guide/admin | |
| Audit | `GET /api/admin/audit?entity=&user=&from=&to=` | admin | |
| Search | `GET /api/search?q=` (full-text) | guide/admin | |
| Notifications (P2) | `GET /api/notifications`, `POST /api/notifications/:id/read` | all | |

**Ownership helpers** in `lib/auth/`: `requireRole(...roles)`, `requireTeamMember(projectId)`, `requireProjectGuide(projectId)`, `requireProjectParticipant(projectId)` (team member, allocated guide/reviewer or admin). Always load ownership from the DB, never trust IDs/roles sent by the client.

---

## 14. Frontend (Next.js) pages and UI components `[PROPOSAL §15]` `[GUIDELINE #9]`

Required pages: login, student workspace, faculty dashboard, project proposal, milestone board, task board, deliverable submission, feedback review, similarity review, admin configuration.

| Route | Role(s) | Content |
|---|---|---|
| `/login` | public | Email + password form, error messages, lockout message |
| `/dashboard` | all (role-aware) | **Student:** my team's progress bar, next deadlines, tasks assigned to me, feedback to resolve, my contribution card. **Guide:** risk cards (low/mod/high/critical counts), high-risk table, approval queue (proposals, milestones, evidence), unresolved feedback, delayed teams. **Reviewer:** allocated submissions to review. **Admin:** system totals, risk heatmap by course, users, allocations needing action. |
| `/proposals`, `/proposals/new`, `/proposals/[id]` | student, guide, admin | Proposal form (title, abstract, problem statement, objectives, scope, domain, technologies, repo link), draft/submit, status timeline from `proposal_actions`, decision panel for guide, "Check originality" button for student |
| `/teams`, `/teams/[id]` | student, admin | Create team, add members, set responsibilities, leader |
| `/projects/[id]` | participants | Overview: status, progress bar, risk card with **reasons**, team, guide/reviewers, timeline |
| `/projects/[id]/milestones` | participants | Milestone board/timeline with status chips, weightage, due dates, % complete; create from template |
| `/projects/[id]/tasks` | participants | **Kanban** (todo / in progress / blocked / done / verified), filters by assignee/status/milestone, assign owner/collaborators, planned vs actual dates |
| `/projects/[id]/deliverables` | participants | Required-deliverable checklist per milestone, upload/register link, version history with change summaries, submit milestone (atomic) |
| `/projects/[id]/feedback` | participants | Feedback list with status, respond/resolve, guide verify/reopen, discussion thread |
| `/projects/[id]/contribution` | guide/admin/student(own) | Per-member evidence table, share %, peer score, verify evidence queue (guide) |
| `/projects/[id]/risk` | guide/admin/team(level+reasons) | Current score + breakdown bars, history chart, risk events |
| `/similarity` | guide/admin | Pending similarity reviews, side-by-side excerpts, scores, decision form; free-text semantic search |
| `/reports` | guide/admin | Delayed teams, unapproved milestones, unresolved feedback, contribution imbalance, high-risk projects; filters + sort + CSV (P2) |
| `/admin/users`, `/admin/departments`, `/admin/courses`, `/admin/templates`, `/admin/allocations`, `/admin/audit` | admin | CRUD tables and filters; audit viewer |

UI components required by the proposal: **forms, tables, filters, progress bars, risk cards, timeline views, search, approval queues, role-based dashboards.** Use Tailwind; keep it clean, responsive and consistent. Show a "How is this calculated?" popover on risk and contribution cards using §9.6. Use loading skeletons, empty states, and toast messages for DB errors translated into plain language.

---

## 15. Data validation and integrity `[PROPOSAL §16]` `[GUIDELINE #12]`

**Database-level validation is mandatory** (the app also validates, but the DB is the last line of defence):

- **Dates:** `due_date ≥ start_date`; `planned_completion_date ≥ planned_start_date`; project `end_date ≥ start_date`; milestone due-date validation.
- **Allowed values:** CHECK on every status/type column (§8); workflow transitions via `status_transitions` trigger.
- **Uniqueness:** unique email; one team per student per course; one active project per team; unique title per course (active); unique `(project_id, sequence_no)`; unique `(deliverable_id, version_number)`; one guide per project; one owner per task; unique commit per repo.
- **Mandatory evidence:** milestone cannot be approved while mandatory deliverable types are missing (trigger).
- **Positive numbers:** `weightage` in (0, 100], total per project ≤ 100; `effort_hours > 0`; `evidence.weight` in (0, 10].
- **Valid ranges:** risk score 0–100 and matching level; similarity score 0–1; peer score 1–5; review score 0–100 and `score ≤ max_score`.
- **Referential integrity:** FKs everywhere with deliberate `ON DELETE` policy (§8.1) so orphaned projects, milestones, tasks, feedback cannot exist.
- **Consistency:** status/timestamp pairs (`approved` ⇒ approver + time; `verified` ⇒ verifier + time; non-draft project ⇒ full proposal text).
- **Immutability:** `proposal_actions` and `audit_logs` cannot be updated or deleted.
- **Application validation (Zod)** mirrors these rules to return field-level errors before the DB is hit.

---

## 16. Security and authentication `[PROPOSAL §16]` `[GUIDELINE #11, #13]`

- **Passwords:** bcrypt (cost 12), only the hash stored, never logged or returned. Minimum length 8 with a letter and a digit. Seed passwords come from `SEED_DEFAULT_PASSWORD`, not from source code.
- **Sessions:** JWT signed with `AUTH_SECRET` (`jose`), stored in an `HttpOnly`, `SameSite=Lax`, `Secure` (in production) cookie; 8-hour expiry; middleware protects every non-public route; logout clears it.
- **Authorization:** role + ownership checks inside every Route Handler (§13). Students cannot access another team's private documents or feedback — add automated tests for this (T-05).
- **Lockout `[ADDED]`:** 5 failed logins → `locked_until = now() + 15 min`; generic "invalid credentials" message (no user enumeration).
- **SQL injection:** parameterised queries only; dynamic `ORDER BY` columns whitelisted.
- **Input handling:** Zod validation; max lengths; escape on output (React does by default; never `dangerouslySetInnerHTML` with user text).
- **File uploads:** allow-list of extensions/MIME (`pdf, docx, md, txt, png, jpg, zip`), max `STORAGE_MAX_FILE_MB`, random storage filenames, SHA-256 checksum stored, files served only through the authorised route.
- **CSRF:** SameSite cookies + verify `Origin` header on state-changing requests.
- **Secrets:** `DATABASE_URL`, `MONGODB_URI`, `AUTH_SECRET`, storage and embedding config only in `.env`; `.env` in `.gitignore`; `.env.example` has placeholders. Run a quick scan (`git grep -n "password\|secret"`) before pushing.
- **DB least privilege:** the app uses role `pp_app` (migration 013), which cannot UPDATE/DELETE `audit_logs` or `proposal_actions`.
- **Rate limiting `[ADDED, P2]`:** simple in-memory limiter on login and similarity endpoints.
- **Security headers `[ADDED, P2]`:** set CSP, `X-Content-Type-Options`, `Referrer-Policy` in `next.config`.
- **Auditability:** log important approvals, rejections, submissions, feedback changes and similarity-review decisions (triggers + explicit audit rows).

---

## 17. Seed data and test cases

### 17.1 Seed data (`npm run db:seed`, with a progress bar) `[ASSUMED]`

No sample data exists, so create it. Everything is relative to `CURRENT_DATE` so overdue/at-risk situations are always visible whenever the demo is run. All users get the password from `SEED_DEFAULT_PASSWORD` (hashed with bcrypt at seed time). Print the demo accounts table at the end of the script (emails only).

**Reference data:** department `CSE`; courses `DBMS Mini Project (CS-DBMS-P, Sem 5, 2026-2027)` and `Software Engineering Mini Project (CS-SE-P, Sem 5, 2026-2027)`; roles; status transitions; one template **"Standard Mini-Project Plan"**:

| # | Milestone | Due offset (days from start) | Weightage | Mandatory deliverable types |
|---|---|---|---|---|
| 1 | Proposal approval | 14 | 10 | proposal |
| 2 | Requirements (SRS) | 35 | 20 | srs |
| 3 | Design (ER + schema) | 60 | 25 | design_doc |
| 4 | Implementation and testing | 85 | 25 | source_code, screenshot, test_report |
| 5 | Final report and demo | 100 | 20 | final_report, presentation |

**Users (about 20):** 1 admin (`admin@projectpulse.test`); 3 faculty guides (`guide1…3@projectpulse.test`); 2 reviewers (`reviewer1…2@…`); 14 students (`student01…14@…`). One user (e.g. guide3) also holds the `reviewer` role to demonstrate multi-role users.

**Teams and scenarios** (each scenario is something the demo must be able to show):

| Team (course) | Members | Proposal idea (short) | Scenario to seed |
|---|---|---|---|
| **Alpha** (DBMS) | 3 | *CampusConnect: Event Management and Volunteer Coordination Portal* | Healthy: milestones 1–2 approved, tasks verified, balanced evidence → **low** risk |
| **Bravo** (DBMS) | 2 | *LibrarySeat: Real-Time Study Seat Reservation with Occupancy Analytics* | **Delayed:** milestone 2 overdue by ~12 days, 4 overdue tasks, SRS missing, no activity for 11+ days → **high/critical** |
| **Charlie** (DBMS) | 3 | *ClinicQueue: Appointment Scheduling with Wait-Time Estimation* | **Contribution imbalance:** one member holds ~80% of verified evidence → **moderate/high** |
| **Delta** (DBMS) | 2 | *AgriAdvisor: Crop Disease Reporting and Advisory Portal* | **Unresolved feedback:** 5 open items (2 overdue), test report missing → **moderate/high** |
| **Echo** (DBMS) | 2 | *CollegeEvents Hub: Platform for Organising and Tracking Campus Events* | Proposal **submitted**, near-duplicate of Alpha → pending similarity review (score ≥ 0.80) |
| **Foxtrot** (SE course) | 2 | *FestFlow: Event Registration System* | Different course but similar topic to Alpha → must **not** appear in DBMS-course similarity results (metadata-filter test); proposal in `revision_requested` |

Write proposal texts (abstract ≥ 50 chars, problem statement ≥ 30 chars, objectives, scope, domain, technologies, repo link) realistic enough for embeddings to behave sensibly: Alpha and Echo describe nearly the same idea in different words; Bravo, Charlie and Delta are clearly different domains.

**Other data:** 5 milestones per active project from the template (dates shifted so the scenarios above hold); 4–8 tasks per milestone with owners/collaborators; a few deliverables with 1–3 document versions each; 3–4 reviews with rubric scores; feedback items in all statuses; some git activities and peer evaluations; 15+ audit rows produced naturally by running the workflows (insert via the same SQL/triggers, not by hand); MongoDB documents (SRS, design doc, test report), 6+ feedback threads, 3 meeting notes; embeddings for all submitted proposals (`embed:backfill` with progress bar); then run `CALL sp_run_risk_sweep()` so risk history exists (also insert 2–3 older risk snapshots per project to give the trend chart something to show).

### 17.2 Test cases `[PROPOSAL §18]` — implement as automated tests where possible and keep a results table for the report

The proposal explicitly lists: **invalid dates, unauthorised access, duplicate team/project records, overdue milestone flags, rollback on failed submission, and the similarity-review workflow.** Those are T-04, T-05, T-06, T-07, T-09, T-12, T-15, T-22, T-23 and must be shown in the demo.

| ID | Level | Test | Expected result |
|---|---|---|---|
| T-01 | API | Login as each of the four roles | Success; role-specific dashboard shown |
| T-02 | API | Wrong password 5 times | Account locked for 15 min; generic error message |
| T-03 | DB | Inspect `users.password_hash` | Bcrypt hash only; no plain text anywhere |
| T-04 | API | Student calls guide-only endpoint (proposal decision, milestone approve) | `403 Forbidden`; nothing changes |
| T-05 | API | Student of team A requests team B's documents, feedback, evidence | `403/404`; no data leaked (**unauthorised access**) |
| T-06 | DB/API | Create milestone with `due_date < start_date`; task with `planned_completion < planned_start`; negative effort/weightage | Rejected by CHECK constraints with friendly error (**invalid dates**) |
| T-07 | DB/API | Create a second active project for a team; add a student to two teams of the same course; duplicate title in a course | Unique violations → clear errors (**duplicate team/project**) |
| T-08 | DB | Milestone weightage total > 100 | Rejected by constraint trigger |
| T-09 | DB | Illegal status change (milestone `planned → approved`, task `todo → verified`) | Rejected by transition trigger |
| T-10 | DB | `UPDATE`/`DELETE` on `proposal_actions` and `audit_logs` | Exception: append-only |
| T-11 | DB | Guide allocated to a project of a team they belong to; non-guide user allocated as guide | Rejected |
| T-12 | DB | Milestone past due and not approved | `risk_events` row created by trigger/sweep; no duplicates on repeat (**overdue flag**) |
| T-13 | DB | `CALL sp_recalculate_risk(p)` for Bravo | Score/level/reason match §9.6 hand-calculation; `breakdown` JSON present |
| T-14 | DB | Insert `risk_assessments` with level not matching score | CHECK violation |
| T-15 | API+DB | Submit milestone with a payload that fails at step 3 (and via `x-test-fail-at` at steps 5/6) | Full rollback: no deliverable, version, review, audit row; milestone status unchanged; Mongo pending doc removed (**rollback**) |
| T-16 | API+DB | Valid milestone submission | Deliverable + version + status `submitted` + pending review + audit row all exist; Mongo doc `confirmed` |
| T-17 | DB | Insert versions without number | Auto-numbered 1, 2, 3 |
| T-18 | API+DB | Approve/reject/request-revision a proposal | Status updated + immutable history row + audit row; reject without comment fails |
| T-19 | DB | Change task/feedback/milestone status | `STATUS_CHANGE` audit row with user id (via `app.current_user_id`) |
| T-20 | API+DB | Delete a draft deliverable; try to delete a submitted one | Draft deleted and audited; submitted one blocked |
| T-21 | DB | Delete a project that has milestones; delete a user referenced by tasks | Blocked by `ON DELETE RESTRICT` |
| T-22 | API+vector | Similarity search for Echo | Alpha returned above threshold with matching text and score; unrelated teams below threshold; **Foxtrot (other course) not returned** |
| T-23 | API+UI | Faculty records decision on a similarity item; student runs "Check originality" | Decision + reviewer + timestamp + audit saved; student sees only a generic warning, no other team's data (**similarity workflow**) |
| T-24 | DB | Verify a task | Verified evidence auto-created for each assignee; unverified evidence excluded from `v_contribution_summary` |
| T-25 | DB | Approve milestone with a missing mandatory deliverable type | Blocked by trigger |
| T-26 | Mongo | Run aggregations A1–A4 | Version counts, type distribution, completeness, feedback themes match seeded data |
| T-27 | DB | `EXPLAIN ANALYZE` on Q2, Q4, Q6 before/after indexes | Index scan used; timings recorded for the report |
| T-28 | DB | Full-text search for "event" | Returns Alpha, Echo, Foxtrot ranked |
| T-29 | Repo | `git grep` for passwords/secrets; check `.env` is ignored | No secrets committed |
| T-30 | UI | Walk through each role's dashboard | All required widgets render with seed data; filters work |

Put SQL-level tests in `db/tests/*.sql` (or Vitest files that run SQL) and API tests under `tests/api`. Provide `npm test` and a script that prints a pass/fail table for the report.

---

## 18. Two-member responsibility plan `[PROPOSAL §17]` `[GUIDELINE #2]`

| Team member | Primary ownership | Cross-contribution requirement |
|---|---|---|
| **Member 1** | PostgreSQL ER diagram, relational schema, DDL, constraints, indexes, views, triggers, stored functions, SQL queries, test data | Contribute to Next.js API routes, integration testing, documentation, and Git commits |
| **Member 2** | Next.js interface, authentication/authorization, MongoDB document model, pgvector semantic-search module, dashboards, UI testing | Contribute to PostgreSQL schema work, DML/API integration, documentation, and Git commits |

**Name mapping `[ASSUMED]`:** Member 1 = **Chiranthan**, Member 2 = **Aadish**. Because Aadish will do most of the hands-on development, agree this split so the history is honest:

- **Chiranthan should personally write, review and commit:** `db/migrations/*` (at least review and refine every file, author 007–014), `db/queries/important_queries.sql`, `db/tests/*`, `db/seeds/*`, `db/mongo/*`, the data dictionary, ER diagram, the DB sections of the report, and a few reporting/dashboard API routes (Q1–Q5) plus their integration tests.
- **Aadish should write and commit:** auth, middleware, Route Handlers for workflows, all UI pages, the embedding/similarity module, Docker/CI scripts, and review/extend the SQL migrations (at least one migration or trigger of his own) so both members contribute to database *and* application work as required.
- **Both:** README, report sections, demo rehearsal. Each person must be able to explain every part in the viva.
- Commits must reflect who actually did the work. Use each person's own Git identity (`git config user.name/email`), small commits, and descriptive messages. Do not rewrite history to change authorship.

---

## 19. Evaluation and demonstration plan `[PROPOSAL §18]` `[GUIDELINE #16]`

Suggested 12–15 minute flow (rehearse it; keep the seeded browser tabs ready):

1. **Problem and motivation (1 min):** late discovery of delays, weak contribution evidence, incomplete documentation, unresolved feedback, overlapping proposals.
2. **Design (2 min):** ER diagram, relational schema, constraints; MongoDB document model; pgvector embedding/retrieval design; why three databases (§7).
3. **Database implementation (3 min):** show migrations running (progress bar), then execute or demonstrate **DDL, DML, joins, grouping, subqueries, views, triggers, functions, indexes, transactions, NoSQL aggregation, vector similarity search** using `psql`/query files and `EXPLAIN ANALYZE`.
4. **Next.js interface (4 min):** guide approves a proposal; students plan milestones and allocate tasks; a student submits a milestone (atomic); feedback is raised, resolved and verified; risk dashboard shows Bravo as high/critical with reasons; contribution imbalance in Charlie; similarity review of Echo vs Alpha with the faculty decision.
5. **Test cases (2 min):** invalid dates, unauthorised access, duplicate team/project, overdue flag, rollback on failed submission, similarity workflow (run the automated test table).
6. **Individual contributions (1 min):** GitHub commit history/`git shortlog` showing both members' database and application work.
7. **Conclusion and future enhancements (1 min).**

Keep a backup: pre-recorded screenshots, and `npm run db:reset && npm run db:seed && npm run embed:backfill` ready to restore the demo state in a couple of minutes.

---

## 20. Build plan (7-day schedule) and priorities

Because the deadline is about one week away, build **P0 first**, vertical slice by vertical slice. Commit after each step; push at least daily.

| Day | Goals | Done when |
|---|---|---|
| **1** | Create repo + `.gitignore`/`.env.example`; Docker Compose; Next.js skeleton; `pg`/`mongodb` clients; migration runner with progress bar; migrations 001–007 and 014; login + JWT session + role middleware; seed users | Empty-DB migrate works; can log in as each role |
| **2** | Migrations 008–013 (functions, views, triggers, alter/drop demos, grants); SQL tests for constraints and triggers; seed script (full scenarios) | `db:reset && db:seed` yields all scenarios; SQL tests green |
| **3** | Teams, allocations, proposals (draft → submit → decision + history); milestones + templates; tasks + assignments + kanban; status transitions | Proposal lifecycle and task board work end to end |
| **4** | Deliverables + versions + file upload; MongoDB documents; **atomic milestone submission**; reviews + feedback workflow + threads; evidence flow | T-15/T-16 pass; feedback resolved and verified in UI |
| **5** | Risk calculation + sweep + history; guide/student/admin dashboards; reports with filters; contribution view | Dashboards show seeded risk correctly (T-12/13) |
| **6** | Embeddings + pgvector search; similarity review screen; student hint; Mongo aggregations; P1 items (peer evaluation, git activities, audit viewer) | T-22/T-23/T-26 pass |
| **7** | Full test run; fix bugs; screenshots; `docs/` (ER diagram, data dictionary, DECISIONS); **README**; **report.pdf**; demo rehearsal; final push | Fresh-clone setup works from the README alone |

**Cut order if time runs short** (drop from the top): notifications → CSV export → rate limiting/security headers → peer-evaluation UI (keep table) → meeting notes → template admin UI (seed only) → DB roles migration 013 at runtime → free-text semantic search. **Never cut:** schema + constraints, triggers/functions/views, atomic submission, risk calculation, similarity search, Mongo aggregation, role-based access, tests for the six proposal-listed cases, README, report.

### 20.1 Definition of done (final checklist)

- [ ] Fresh clone → follow README → app runs, migrations and seed succeed
- [ ] ER diagram, relational schema, data dictionary generated from the real DDL
- [ ] CREATE, ALTER, DROP, PK/FK, constraints, indexes, views all present in migrations
- [ ] INSERT/UPDATE/DELETE/SELECT with JOIN, GROUP BY, HAVING, ORDER BY, aggregates, subqueries demonstrated
- [ ] ≥ 4 advanced features demonstrated (this project has 8)
- [ ] Three database paradigms in use, each justified
- [ ] Vector search documented: what, model, storage, metric, retrieval
- [ ] Next.js UI with forms, tables, search, filters, dashboards, progress bars, risk cards, timelines, approval queues
- [ ] 4 roles with enforced authorization; unauthorised-access test passes
- [ ] Passwords hashed; no credentials in Git; `.env.example` present
- [ ] DB-level validation tests pass
- [ ] Test results table filled in
- [ ] Commits from both members; README complete
- [ ] `report.pdf` generated and checked; repo link ready

---

## 21. Documentation and `report.pdf` `[GUIDELINE #14]` `[PROPOSAL §20]`

The submission needs **`report.pdf`**. Write it in `docs/REPORT.md`, convert to PDF (pandoc, or any Markdown-to-PDF tool; export Mermaid diagrams to PNG with `mmdc` first), and check pagination and screenshots. Required contents, in this order (matching the guidelines list):

1. Title page (title, team members, course, instructor, date)
2. **Problem statement** (§2.2–2.3) and motivation (§2.4)
3. **Objectives** (§2.5)
4. **Scope** (§2.6, in/out)
5. **Functional requirements** (§5 table, condensed)
6. **ER diagram** (generated from final DDL; Appendix B for the relationship set)
7. **Relational schema** (tables, PKs, FKs, constraints)
8. **Database choice and justification** (§7: SQL vs NoSQL vs vector, and why)
9. **Data dictionary / schema description** (generated: table, column, type, constraint, description)
10. **SQL implementation**: DDL (CREATE/ALTER/DROP, constraints, indexes, views), triggers, functions, transaction
11. **NoSQL implementation**: collections, document model, indexes, aggregation pipelines with sample output
12. **Vector implementation**: what is embedded, model, storage, metric, retrieval, threshold, ethical control, sample results
13. **Important queries** (Q1–Q14 with output and the concept each demonstrates; `EXPLAIN ANALYZE` evidence)
14. **System architecture** (diagram from §6.2, API layer, security design)
15. **Application screenshots** (list below)
16. **Testing results** (table T-01…T-30 with pass/fail and evidence)
17. **Conclusion and future enhancements** (§23)
18. Team contributions and GitHub link; references

**Screenshots to capture:** S-01 login; S-02 student dashboard; S-03 guide risk dashboard; S-04 admin dashboard; S-05 proposal form; S-06 proposal approval with history; S-07 team/guide allocation; S-08 milestone timeline; S-09 task kanban; S-10 deliverable submission + versions; S-11 atomic submission failure/rollback message; S-12 feedback workflow + thread; S-13 contribution view; S-14 risk detail with breakdown and trend; S-15 similarity review screen; S-16 reports with filters; S-17 audit log; S-18 terminal: migrations with progress bar; S-19 `psql` showing trigger/view/function output; S-20 Mongo aggregation output; S-21 test results; S-22 GitHub commit graph/contributors.

---

## 22. Git, GitHub and README `[GUIDELINE #15]`

- Create the GitHub repo first (suggested name `projectpulse`), add `.gitignore` (`node_modules`, `.next`, `.env`, `storage/uploads`), commit `.env.example`.
- Branching: `main` (stable) + short-lived `feat/<area>` branches; merge via pull requests so both members' work is visible. Commit often with clear messages (`feat(db): add risk calculation function`, `feat(api): proposal decision endpoint`, `test(db): overdue milestone trigger`, `docs: data dictionary`).
- Check contributions with `git shortlog -sn --all`; both members must have meaningful commits touching **both** database files and application files.
- **README.md must contain:** project description and features; tech stack; architecture diagram; prerequisites (Node version, Docker, Git); clone + install steps; **environment variable table** (from §6.4); how to start databases (`npm run db:up`); how to run migrations, seed, Mongo init, embedding backfill; how to start the app; demo accounts (emails; password = the value of `SEED_DEFAULT_PASSWORD` the person chose); how to run tests; folder structure; DB design summary (links to `docs/`); screenshots; troubleshooting (pgvector extension missing, model download needs internet, ports in use); team and contributions; license/credits.
- Add a `docs/DECISIONS.md` listing every `[ASSUMED]` choice (stack, formulas, thresholds) and every deviation from this spec.

---

## 23. Conclusion and future enhancements `[PROPOSAL §4]`

Conclusion points: governance and early intervention; evidence-based, explainable contribution and risk indicators; faculty remain the decision-makers for grading and originality; three database paradigms each used for what it is best at.

Future enhancements (also the "out of scope" list): GitHub OAuth sync of commits and pull requests; OCR of scanned documents; email/WhatsApp notifications; machine-learning predictive risk models (the current formula is rule-based and explainable); automated *assisted* plagiarism reports with source highlighting (still human-decided); LMS/ERP integration; PDF text extraction and per-section document embeddings; PostgreSQL row-level security; analytics across semesters; mobile-friendly PWA.

---

## 24. Assumptions register and open items

| Item | Status |
|---|---|
| Exact deadline date | Unknown; plan for 7 days |
| Tech choices in §6.1 (TypeScript, Tailwind, `pg`, custom JWT, local embeddings, Docker, local files) | `[ASSUMED]`; change freely, record in `docs/DECISIONS.md` |
| Risk, contribution, completeness formulas and thresholds (§9.6, §12) | `[ASSUMED]`; any reasonable, explainable formula is acceptable as long as the UI shows how it works |
| Workflow state machines (§9.7) | `[ASSUMED]` (proposal only states "controlled workflow transitions") |
| Name mapping Member 1 = Chiranthan, Member 2 = Aadish | `[ASSUMED]`; swap if different |
| Where the proposal and the old diagram differed | Proposal wins (see Appendix A note) |
| Whether the instructor wants the report in a particular format/length | Not specified; follow §21 |
| Local vs cloud databases / deployment | Local Docker for the demo |

---

## Appendix A — Original draft schema diagram (SUPERSEDED)

This is the diagram that survived the lost chat. It is **kept for reference only**. It lacks many attributes the proposal requires (e.g. project objectives/scope/domain/technologies, task dates and effort, feedback creator/response/verification, risk score, similarity reviewer/comments, audit entity/old-new values), has no embeddings table, no template table, no immutable proposal history, and models Team↔Project as strictly one-to-one. **Section 8 replaces it.** Use this diagram only to confirm that all 22 original tables still exist in the new design (they do).

```mermaid
erDiagram
    DEPARTMENTS ||--o{ COURSES : "offers"
    COURSES ||--o{ TEAMS : "runs"
    TEAMS ||--o{ TEAM_MEMBERS : "has"
    USERS ||--o{ TEAM_MEMBERS : "joins"
    TEAMS ||--|| PROJECTS : "owns"
    USERS ||--o{ USER_ROLES : "holds"
    ROLES ||--o{ USER_ROLES : "assigned_via"
    PROJECTS ||--o{ GUIDE_ALLOCATIONS : "allocated"
    USERS ||--o{ GUIDE_ALLOCATIONS : "guides"
    PROJECTS ||--o{ MILESTONES : "has"
    MILESTONES ||--o{ TASKS : "has"
    TASKS ||--o{ TASK_ASSIGNMENTS : "has"
    USERS ||--o{ TASK_ASSIGNMENTS : "assigned"
    MILESTONES ||--o{ DELIVERABLES : "produces"
    DELIVERABLES ||--o{ DOCUMENT_VERSIONS : "has"
    MILESTONES ||--o{ REVIEWS : "reviewed_in"
    REVIEWS ||--o{ FEEDBACK_ITEMS : "generates"
    USERS ||--o{ FEEDBACK_ITEMS : "resolves"
    TASKS ||--o{ GIT_ACTIVITIES : "linked_to"
    USERS ||--o{ GIT_ACTIVITIES : "performs"
    USERS ||--o{ CONTRIBUTION_EVIDENCE : "submits"
    PROJECTS ||--o{ CONTRIBUTION_EVIDENCE : "for"
    PROJECTS ||--o{ RISK_ASSESSMENTS : "has"
    PROJECTS ||--o{ SIMILARITY_REVIEWS : "compared_as_source"
    PROJECTS ||--o{ SIMILARITY_REVIEWS : "compared_as_match"
    USERS ||--o{ PEER_EVALUATIONS : "evaluates_as_evaluator"
    USERS ||--o{ PEER_EVALUATIONS : "evaluated_as_evaluatee"
    USERS ||--o{ AUDIT_LOGS : "performs_action"

    DEPARTMENTS {
        int dept_id PK
        string dept_name
    }
    COURSES {
        int course_id PK
        int dept_id FK
        string course_name
        string semester
    }
    TEAMS {
        int team_id PK
        int course_id FK
        string team_name
    }
    USERS {
        int user_id PK
        string name
        string email UK
        string password_hash
        string status
    }
    ROLES {
        int role_id PK
        string role_name
    }
    USER_ROLES {
        int user_id PK,FK
        int role_id PK,FK
    }
    TEAM_MEMBERS {
        int team_id PK,FK
        int user_id PK,FK
        string responsibility
    }
    PROJECTS {
        int project_id PK
        int team_id FK,UK
        string title
        string abstract
        string problem_statement
        string status
    }
    GUIDE_ALLOCATIONS {
        int allocation_id PK
        int project_id FK
        int user_id FK
        string allocation_role
    }
    MILESTONES {
        int milestone_id PK
        int project_id FK
        string title
        date due_date
        string status
        numeric weightage
    }
    TASKS {
        int task_id PK
        int milestone_id FK
        string title
        string status
    }
    TASK_ASSIGNMENTS {
        int task_id PK,FK
        int user_id PK,FK
    }
    DELIVERABLES {
        int deliverable_id PK
        int milestone_id FK
        string deliverable_type
        string repo_link
    }
    DOCUMENT_VERSIONS {
        int version_id PK
        int deliverable_id FK
        int version_number
        string change_summary
        timestamp uploaded_at
    }
    REVIEWS {
        int review_id PK
        int milestone_id FK
        int reviewer_id FK
        string comments
        date review_date
    }
    FEEDBACK_ITEMS {
        int feedback_id PK
        int review_id FK
        int assigned_user_id FK
        string description
        string resolution_status
    }
    GIT_ACTIVITIES {
        int git_id PK
        int task_id FK
        int user_id FK
        string commit_ref
        string repo_url
    }
    CONTRIBUTION_EVIDENCE {
        int evidence_id PK
        int user_id FK
        int project_id FK
        string evidence_type
        boolean verified_flag
    }
    RISK_ASSESSMENTS {
        int risk_id PK
        int project_id FK
        string risk_level
        string reason
        timestamp calculated_at
    }
    SIMILARITY_REVIEWS {
        int similarity_id PK
        int source_project_id FK
        int matched_project_id FK
        numeric similarity_score
        string faculty_decision
    }
    PEER_EVALUATIONS {
        int evaluation_id PK
        int evaluator_id FK
        int evaluatee_id FK
        int project_id FK
        numeric score
    }
    AUDIT_LOGS {
        int log_id PK
        int user_id FK
        string action
        timestamp created_at
    }

```

---

## Appendix B — Corrected ER relationships (relationships only)

Generate the full ER diagram (with every attribute) from the final DDL into `docs/er_diagram.mmd` and export it as an image for the report. This relationship set is the target design (it includes the original relationships plus the additions in Section 8):

```mermaid
erDiagram
    DEPARTMENTS ||--o{ COURSES : offers
    DEPARTMENTS ||--o{ USERS : "belongs to (optional)"
    COURSES ||--o{ TEAMS : runs
    COURSES ||--o{ PROJECT_TEMPLATES : "has (optional)"
    TEAMS ||--o{ TEAM_MEMBERS : has
    USERS ||--o{ TEAM_MEMBERS : joins
    USERS ||--o{ USER_ROLES : holds
    ROLES ||--o{ USER_ROLES : "assigned via"
    TEAMS ||--o{ PROJECTS : "owns (one ACTIVE per team)"
    COURSES ||--o{ PROJECTS : "for course"
    PROJECT_TEMPLATES ||--o{ TEMPLATE_MILESTONES : defines
    PROJECT_TEMPLATES ||--o{ PROJECTS : "used by (optional)"
    PROJECTS ||--o{ PROPOSAL_ACTIONS : "decision history (immutable)"
    USERS ||--o{ PROPOSAL_ACTIONS : acts
    PROJECTS ||--o{ GUIDE_ALLOCATIONS : allocated
    USERS ||--o{ GUIDE_ALLOCATIONS : "guides / reviews"
    PROJECTS ||--o{ MILESTONES : has
    MILESTONES ||--o{ MILESTONE_REQUIRED_DELIVERABLES : requires
    MILESTONES ||--o{ TASKS : has
    TASKS ||--o{ TASK_ASSIGNMENTS : has
    USERS ||--o{ TASK_ASSIGNMENTS : assigned
    MILESTONES ||--o{ DELIVERABLES : produces
    DELIVERABLES ||--o{ DOCUMENT_VERSIONS : has
    MILESTONES ||--o{ REVIEWS : "reviewed in"
    USERS ||--o{ REVIEWS : writes
    REVIEWS ||--o{ REVIEW_SCORES : scored
    REVIEWS ||--o{ FEEDBACK_ITEMS : generates
    USERS ||--o{ FEEDBACK_ITEMS : "creates / resolves / verifies"
    PROJECTS ||--o{ GIT_ACTIVITIES : tracks
    TASKS ||--o{ GIT_ACTIVITIES : "linked to (optional)"
    USERS ||--o{ GIT_ACTIVITIES : performs
    PROJECTS ||--o{ CONTRIBUTION_EVIDENCE : for
    USERS ||--o{ CONTRIBUTION_EVIDENCE : submits
    PROJECTS ||--o{ RISK_ASSESSMENTS : has
    PROJECTS ||--o{ RISK_EVENTS : raises
    PROJECTS ||--o{ SIMILARITY_REVIEWS : "compared as source"
    PROJECTS ||--o{ SIMILARITY_REVIEWS : "compared as match"
    PROJECTS ||--o{ PROJECT_EMBEDDINGS : "vectors of"
    PROJECTS ||--o{ PEER_EVALUATIONS : in
    USERS ||--o{ PEER_EVALUATIONS : "evaluator / evaluatee"
    USERS ||--o{ AUDIT_LOGS : "performs action"
    USERS ||--o{ NOTIFICATIONS : receives
```

Cardinality note: the old diagram showed `TEAMS ||--|| PROJECTS`. The proposal says "one team owns one active project for a project course", so the design allows a team to have older rejected/archived projects but only **one active** project (partial unique index `uq_projects_active_team`).

---

## Appendix C — Quick command reference (target)

```bash
cp .env.example .env            # then fill in real values locally (never commit)
npm install
npm run db:up                   # Postgres (pgvector) + MongoDB via Docker
npm run db:migrate              # applies db/migrations/*.sql with a progress bar
npm run mongo:init              # collections, validators, indexes
npm run db:seed                 # demo data with a progress bar
npm run embed:backfill          # embeddings for seeded proposals, with a progress bar
npm run risk:sweep              # first risk snapshots, with a progress bar
npm run dev                     # http://localhost:3000
npm test
```

*End of specification.*
