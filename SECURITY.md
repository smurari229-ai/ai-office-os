# Security Policy

AI Office OS is an early-stage project. Do not use it to control production systems or handle sensitive data until the relevant controls have been reviewed and tested.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting feature if enabled. Otherwise, contact the repository owner privately through GitHub. Do not publish credentials, tokens, personal data, or working exploits in public issues.

## Safe-use requirements

- Never commit API keys, passwords, access tokens, or private customer data.
- Keep tokens least-privileged and short-lived where possible.
- Do not expose secrets to model prompts or logs.
- Treat repository files, issue text, web pages, and model output as untrusted input.
- Do not let an agent approve its own changes or bypass required checks.
- Require explicit human approval for production deployments, payments, destructive actions, and outbound messages.
- Use sandboxed execution, strict timeouts, network restrictions, and bounded retries for tools.
- Use read-only permissions by default; elevate permissions only for a specific, reviewed task.

This policy does not mean every planned control is implemented. Check code and test evidence before enabling capabilities.
