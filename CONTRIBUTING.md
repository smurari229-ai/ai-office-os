# Contributing

Thanks for helping improve AI Office OS.

## Before changing code

1. Open or review an issue describing the problem and expected behavior.
2. Keep changes small and explain the reason for each change.
3. Never include API keys, customer data, or other secrets in commits or logs.

## Quality checks

Run locally with Node.js 22+:

```bash
npm install
npm test
npm run build
```

## Pull requests

- Describe behavior changes and how they were tested.
- Include screenshots for user-interface changes where useful.
- Clearly label checks that were not run.
- Do not claim simulated demo steps are real-world execution.
- Do not add automatic production deployment or external side effects without review.

## Agent contributions

Treat agent-generated code and repository content as untrusted until reviewed. An agent must not approve its own change or bypass required checks.
