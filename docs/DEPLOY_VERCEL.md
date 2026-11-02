# Vercel deployment

ProjectPulse's Next.js pages and API routes run in one Vercel project. The app needs three persistent services: Neon PostgreSQL (with the `vector` extension), MongoDB Atlas, and a **private** Vercel Blob store. The source repository is [chiranthan-sathrasala/DBMS-Mini-Project](https://github.com/chiranthan-sathrasala/DBMS-Mini-Project). The Vercel project currently deploys a fork under the connected Vercel account; sync that fork with the source after future pushes.

## Required Vercel environment variables

| Name | Value |
|---|---|
| `DATABASE_URL` | Neon pooled connection URL for the `pp_app` role, created by migration 013 |
| `MONGODB_URI` | Atlas connection URL for the `projectpulse` database |
| `MONGODB_DB` | `projectpulse` (also the default) |
| `AUTH_SECRET` | Long random secret; keep the same value across redeploys |
| `JOB_SECRET` | Long random secret for the risk sweep endpoint |
| `STORAGE_DRIVER` | `vercel-blob` |
| `STORAGE_MAX_FILE_MB` | `4` |
| `BLOB_READ_WRITE_TOKEN` | Injected when a private Blob store is connected to the project |
| `VERCEL_SUPPORT_LARGE_FUNCTIONS` | `1` if the model's server function exceeds the standard package limit |

Vercel's Function request and response body limit is 4.5 MB, so uploads through the existing authenticated API are limited to 4 MB including a little room for form data. The download route also stays below that limit. `STORAGE_DRIVER=local` remains available for local development.

## Initialize the databases

The Neon database must exist before migration. Run `npm run db:migrate` with `MIGRATION_DATABASE_URL` set to the **direct** owner connection URL, `APP_DB_PASSWORD` set to a long random secret, and `SKIP_DATABASE_CREATE=1`. Migration 013 creates the app role. Give Vercel the pooled URL with `pp_app` and that password as `DATABASE_URL`. Keep the owner URL out of Vercel.

After Atlas is ready, run `npm run mongo:init`. Seed once with `npm run db:seed` using the owner URL, Atlas URL, `SEED_DEFAULT_PASSWORD`, `STORAGE_DRIVER=vercel-blob`, and a private Blob token. The seed writes sample files to Blob, then populates SQL and MongoDB, and generates embeddings. Do not run it again on a populated database. For a hosted sample account, use `admin@projectpulse.test` and the seed password; change the admin password after first login.

The embedding model is downloaded to `/tmp` on a Vercel Function's first use. Cold starts for similarity checks can take longer than ordinary requests. If that causes a timeout, move embedding generation to a persistent worker and keep the existing pgvector storage and similarity queries.
