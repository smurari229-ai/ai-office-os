# AI Office OS

**AI Office OS is an early MVP for real AI-assisted planning and user-scoped workflow records.**

> **Important status:** this branch adds a real server-side Gemini planning endpoint, Supabase email authentication endpoints, and an authenticated Supabase workflow persistence API with row-level security. These features are usable only after the owner configures the provider and database migration. The application still does **not** execute code, run an autonomous multi-agent loop, edit repositories, create GitHub PRs, or verify proposed tasks. It is not production-ready and does not guarantee correct output or income.

## Implemented in this branch

- Server-side Gemini plan generation through `POST /api/plan`; no fake AI fallback.
- Strict validation of model output, input limits, timeouts, bounded provider retry, request IDs, and redacted structured logs.
- Supabase email sign-up/sign-in through `POST /api/auth`. Access tokens are held in application memory only and cleared on refresh/sign-out.
- `GET /api/tasks` and `POST /api/tasks` authenticate the supplied access token against Supabase Auth before using it against PostgREST.
- Migration at `supabase/migrations/202610140001_office_workflows.sql` creates user-owned workflow records, constraints, unique idempotency keys, and RLS policies.
- Dashboard can generate a validated AI proposal, save it to the user's database, and load that user's saved workflow list.
- UI labels unexecuted proposals as proposals; it does not show simulated tasks as verified completions.

## Not implemented / not production-ready

- Persistent background worker/orchestration, task dependencies and retries, pause/resume/cancel.
- Independent Boss/Manager/Developer/QA/Operations agent executions.
- GitHub OAuth/repository access, patch review, branch/commit/PR creation, and CI result retrieval.
- Isolated code execution, verified QA, production deployment automation.
- MFA, password reset/session refresh flow, distributed rate limiting, and comprehensive production monitoring.
- Production readiness requires independent security review, live integration tests, deployment verification, and owner-controlled credentials.

## Setup

Requirements: Node.js 22+ and npm.

1. Create a Supabase project.
2. In Supabase SQL Editor, run `supabase/migrations/202610140001_office_workflows.sql`.
3. Add server-side environment variables in Vercel (or your Node server):
   - `SUPABASE_URL`: project URL, e.g. `https://YOUR_PROJECT.supabase.co`
   - `SUPABASE_ANON_KEY`: project's public anon/publishable key; do not use a service-role key
   - `GEMINI_API_KEY`: server-side Gemini API key
   - `GEMINI_MODEL`: optional, defaults to `gemini-2.5-flash`
4. Redeploy after setting variables. For signup, follow the Supabase project's email verification settings.
5. Open the deployed app, create/sign into an account, then submit a goal. A successful workflow save confirms only a persisted **proposal**; no task is executed.

Never prefix server secrets with `VITE_`. See `.env.example`.

## Local commands

```bash
npm install
npm run typecheck:api
npm test
npm run build
```

Vite's dev server does not automatically provide production serverless API routes. Use a matching local serverless adapter or test API routes on the configured deployment platform.

## Cost and security notes

- Gemini quota, free-tier availability, and pricing depend on current provider terms; unlimited free AI is not promised.
- The planning endpoint has an in-memory per-runtime rate limit. It is not a distributed quota or billing system.
- Supabase Auth and RLS scope records by the authenticated user. Do not submit confidential material until the deployment has been independently reviewed.
- No service-role key is needed by these endpoints. Never expose one in frontend code.
- A successful API plan/save does not mean code was changed, tests passed, or any real-world action completed.
