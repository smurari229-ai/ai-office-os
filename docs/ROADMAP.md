# AI Office OS roadmap

This roadmap separates working, deterministic GitHub automation from future AI-powered behavior.

## Stage 1 — GitHub-only foundation

- [x] Public repository, MIT license, security policy, contribution guidance
- [x] React dashboard with a local demo task workflow
- [x] Unit tests for basic planning and QA blocking
- [x] CI workflow for tests and production build
- [x] Issue form for submitting office goals
- [x] GitHub Actions workflow that comments a deterministic plan on matching goal issues
- [ ] Confirm Actions are enabled and observe a successful workflow run in this repository

## Stage 2 — Model-backed planning (optional)

- [ ] Add a server-side model adapter with provider selection and budget limits
- [ ] Validate model output against a strict schema
- [ ] Treat issue text and repository files as untrusted prompt input
- [ ] Add per-task timeout, retry budget, and cost limits
- [ ] Keep demo mode functional without credentials

A real model integration may require a provider account, secrets, and may incur cost. Do not promise it is free until the provider's current terms and limits are checked.

## Stage 3 — Safe coding agent

- [ ] Create proposed changes only on a separate branch
- [ ] Use short-lived, least-privilege credentials
- [ ] Run tests in an isolated environment
- [ ] Publish a pull request with logs and a test summary
- [ ] Never merge or deploy automatically by default

## Stage 4 — Multi-role coordination

- [ ] Boss agent: goals, priority, acceptance criteria
- [ ] Manager agent: dependencies, task assignment, bounded retries
- [ ] Developer agent: code proposals in a sandbox
- [ ] QA agent: independent tests and evidence
- [ ] HR/Operations agent: workload and process reporting
- [ ] Human owner remains accountable for decisions and high-impact actions

## Definition of done

A task is complete only when its acceptance criteria are met and the evidence is linked. If a check did not run, report NOT_RUN; if a dependency blocks it, report BLOCKED. An agent's own statement is not sufficient evidence.
