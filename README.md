# AI Office OS

**An open-source, GitHub-centred multi-agent workspace** for planning work, assigning tasks, proposing changes, and verifying results.

> **Status:** early MVP. The application has a real server-side Gemini planning endpoint when configured. It returns a validated task proposal; it does **not** execute tasks, persist server-side workflows, modify repositories, or prove proposed work was completed. Authentication, durable multi-user storage, GitHub OAuth/write workflows, and isolated code execution are not implemented. This is not production-ready and does not guarantee correct output or income.

## Vision

- **Founder:** sets goals and approves consequential actions.
- **Boss agent:** turns goals into outcomes and acceptance criteria.
- **Manager agent:** breaks work into small tasks and tracks status.
- **Developer agent:** proposes code changes for review.
- **QA agent:** checks results against tests and acceptance criteria.
- **Operations agent:** monitors workflow progress and reports blockers.

These are software roles, not independent people. The current AI endpoint makes one model request to draft a plan; the role names in that plan are assignments, not five independently running agents.

## Current features

- Responsive dashboard for the office workspace.
- Real server-side Gemini request through `POST /api/plan` when configured.
- Strict validation of AI-proposed tasks and acceptance criteria.
- Input limits, request timeout, bounded retry for transient provider server errors, in-memory per-instance rate limiting, request IDs, and redacted structured logs.
- Explicit missing-credential/provider errors instead of fake AI output.
- A clearly labelled local demo workflow remains available; its progress is simulated and must not be treated as evidence.
- No real task execution, durable server-side task persistence, user authentication, GitHub writes, or safe arbitrary-code sandbox yet.

## Local development

Requirements: Node.js 22+ and npm.

```bash
npm install
npm run dev
npm run typecheck:api
npm test
npm run build
```

The frontend is Vite/React. The `api/plan.ts` handler is designed for a serverless Node-compatible deployment such as Vercel; Vite's dev server does not automatically provide production serverless routes unless a matching local adapter is configured.

## Configure real AI

1. Create a Gemini API key in Google AI Studio and review current quotas and pricing before use.
2. Set `GEMINI_API_KEY` as a **server-side Secret** in your hosting provider. Never use a `VITE_` prefix.
3. Optionally set `GEMINI_MODEL` (default: `gemini-2.5-flash`) as a server-side environment variable.
4. Redeploy after adding or changing environment variables.
5. Submit a goal. A successful response means only that the model returned a schema-valid proposal; it does not mean tasks were executed.

See `.env.example` for variable names. Free-tier access, quota, and availability depend on provider terms and can change. The application does not promise unlimited free AI or a fixed cost.

## Verification and security boundaries

- `npm run typecheck:api` checks the server API's TypeScript.
- `npm test` runs unit tests, including API boundary tests.
- `npm run build` builds the frontend.
- API rate limiting is in-memory and per runtime instance; it is not a distributed quota system.
- There is no production-grade authentication or per-user authorization yet. Do not submit confidential goals or private repository contents.
- Do not enable repository writes, deployments, payments, destructive actions, or arbitrary code execution without explicit approval gates and a separately reviewed implementation.

See [SECURITY.md](./SECURITY.md) for the current safe-use policy.
