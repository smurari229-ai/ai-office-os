# Model provider integration boundary

**Status: contract and validation only. No provider is connected yet.** The app remains deterministic and works without API keys.

## Before adding a provider

- Keep provider credentials on a trusted server; never use a `VITE_*` variable for a secret, commit a key, or send secrets to the browser.
- Make provider use opt-in through explicit server-side configuration. Missing configuration must leave demo mode working.
- Treat all provider output as untrusted data. Parse structured output and pass it through `validateProposedPlan` before displaying or acting on it.
- Enforce `DEFAULT_PROVIDER_BUDGET` server-side. The browser cannot be the authority for cost, request counts, or retries.
- Add request timeouts, rate limits, bounded response sizes, and safe error messages that do not expose credentials or raw provider payloads.
- Do not give a model direct shell, repository-write, deployment, payment, or messaging permissions. Use a separate isolated execution service and human approval gates before any consequential action.
- Record provider name, outcome, duration, and a request correlation ID; do not log keys, full prompts containing sensitive data, or raw secrets.

## Contract

`src/provider-contract.ts` defines a provider interface, a strict proposed-plan schema, role allowlisting, text/task bounds, and a bounded request/retry/output-token budget. It does not perform HTTP requests and is not itself an AI integration.

## Required follow-up before enabling live calls

1. Choose and document a provider and server runtime.
2. Add a server-only endpoint with authentication, rate limiting, timeout, and secret handling.
3. Validate the request and provider response on the server; never trust client-provided budgets.
4. Add mocked adapter tests for missing keys, provider timeout/errors, malformed JSON, rate limits, and secret redaction.
5. Review privacy, retention, cost ceilings, and deployment configuration.
6. Keep demo mode as the default and test it with no secrets configured.

A passing unit test or build does not prove provider connectivity, deployment, or autonomous coding.