# ProjectPulse — rules for Claude Code

Full spec: `../PROJECTPULSE_SPEC.md` (single source of truth). This file summarises §0, §6 and §20.

## Ground rules (§0)
- Priority when sources disagree: instructor guidelines > approved proposal > everything else. The Appendix A diagram is superseded by §8.
- Build in **vertical slices** (DB → API → UI → test), not layer by layer. Follow the day plan below.
- **No secrets in code.** All credentials come from env vars. Commit `.env.example`, never `.env`.
- **Raw SQL, parameterised only** (`$1…`). No string-built SQL, no ORM. Dynamic ORDER BY columns are whitelisted.
- Constraints, views, functions, triggers and transactions live in versioned `db/migrations/*.sql`.
- Every script that can take more than a couple of seconds shows a `cli-progress` bar (migrate, reset, seed, embed backfill, risk sweep).
- Plain-language comments in SQL/code explaining *why* a constraint or trigger exists (the team must explain it in a viva).
- Ambiguity → pick the simplest option satisfying the guidelines and record it in `docs/DECISIONS.md`.
- After every slice run `npm run db:reset` to prove migrations are repeatable.
- Commits must reflect who did the work (use each member's own git identity). Never rewrite history.

## Stack (§6)
Next.js App Router + TypeScript + Tailwind; Route Handlers as the API; PostgreSQL (`pg`, raw SQL) with pgvector; MongoDB (`mongodb` driver, `$jsonSchema` validators); local embeddings `Xenova/all-MiniLM-L6-v2` (384-dim); `bcryptjs` + `jose` JWT in HttpOnly cookie; Zod validation; Vitest.

## Where logic lives
Integrity rules that must hold for any client → DB (CHECK/FK/trigger). Orchestration needing the current user, files or two DBs → Route Handlers. Every transaction starts with `SET LOCAL app.current_user_id = '<id>'` so audit triggers attribute rows. PostgreSQL is the system of record; Mongo docs reference PG integer ids and use `state: pending|confirmed` with compensation on rollback.

## Build plan (§20) — P0 first, never cut: schema+constraints, triggers/functions/views, atomic submission, risk calc, similarity search, Mongo aggregation, role-based access, tests for the six proposal-listed cases, README, report
1. Repo, Docker/native DBs, Next skeleton, migration runner, migrations 001–007 + 014, login/JWT/role middleware, seed users
2. Migrations 008–013, SQL tests, full seed scenarios
3. Teams, allocations, proposals, milestones/templates, tasks/kanban, transitions
4. Deliverables/versions/upload, Mongo docs, atomic milestone submission, reviews/feedback, evidence flow
5. Risk calc + sweep + history, dashboards, reports, contribution view
6. Embeddings + pgvector search, similarity review, student hint, Mongo aggregations, P1 extras
7. Full tests, screenshots, docs, README, report.pdf, demo rehearsal

Cut order if short: notifications → CSV export → rate limiting/headers → peer-eval UI → meeting notes → template admin UI → migration 013 at runtime → free-text semantic search.

## Status
All seven days of the plan are implemented and verified by the automated suite (see `docs/TEST_RESULTS.md`). Remaining optional (P2) items are listed in `docs/DECISIONS.md` (D-42). When changing anything: run `npm run db:reset && npm run db:seed`, `npx tsc --noEmit`, `npm test`, and regenerate the docs (`docs:data-dictionary`, `test:report`, `docs:report`) if the schema or behaviour changed.
