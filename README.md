# AI Office OS

**An open-source, GitHub-centred multi-agent workspace** for planning work, assigning tasks, proposing changes, and verifying results.

> **Status:** early MVP. The current app runs a deterministic demo workflow; it does not yet connect to a real AI model or autonomously modify repositories. It is not production-ready and does not guarantee correct output or income.

## Vision

- **Founder:** sets goals and approves consequential actions.
- **Boss agent:** turns goals into outcomes and acceptance criteria.
- **Manager agent:** breaks work into small tasks and tracks status.
- **Developer agent:** later proposes code changes in an isolated workspace.
- **QA agent:** checks results against tests and acceptance criteria.
- **HR/Operations agent:** later helps with workload and team processes.

These are software roles, not independent people. Each role needs explicit tools, permissions, budgets, and verifiable outputs.

## MVP principles

1. Human approval for production deployment, payments, destructive actions, and external messages.
2. Least-privilege permissions; no unrestricted shell or production credentials.
3. Evidence over claims: status must be supported by checks and artifacts.
4. Bounded autonomy: limits on retries, task duration, tool calls, and model spending.
5. Secrets never belong in source control or model logs.
6. Provider integrations must be optional and explicitly configured.
7. Record decisions and failures without logging secrets.

## Current features

- Responsive dashboard for a virtual AI office.
- Deterministic demo workflow that runs without API keys or paid services.
- Goal-to-task breakdown across Boss, Manager, Developer, and QA roles.
- Task statuses, activity log, demo retry simulation, and local persistence.
- No real repository writes, external messages, payments, or deployment actions.

## Local development

Requirements: Node.js 22+ and npm.

```bash
npm install
npm run dev
npm test
npm run build
```

The app runs in demo mode. No API key is required. `npm install` creates `package-lock.json`; commit it so CI can use `npm ci`.

## Planned milestones

- [x] Repository foundations, MIT license, security policy
- [x] Responsive demo dashboard and deterministic task workflow
- [x] Unit tests and GitHub Actions CI
- [ ] Real model-provider adapter behind explicit configuration
- [ ] Sandboxed tool execution and approval gates
- [ ] Optional persistence and deployment
- [ ] Security review before enabling repository-write tools

## Security

See [SECURITY.md](SECURITY.md). Treat repository files, issue text, web pages, and model output as untrusted input. Never enable an agent to approve its own changes.

## License

MIT. See [LICENSE](LICENSE).
