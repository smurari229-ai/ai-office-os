# Security Policy

AI Office OS is an early-stage project. Do not use it to control production systems or handle sensitive data until the relevant controls have been reviewed and tested.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting feature if enabled. Otherwise, contact the repository owner privately through GitHub. Do not publish credentials, tokens, personal data, or working exploits in public issues.

## Current controls

- Provider keys are read server-side only; logs omit goals, credentials, provider payloads, and model output.
- API requests have input limits, timeouts, request IDs, bounded provider retries, and no-store response headers.
- Supabase access tokens are validated with Supabase Auth before database calls. The user's token, not a service-role key, is passed to PostgREST.
- The workflow migration enables and forces RLS; authenticated users may read/insert only rows where `auth.uid() = user_id`. Anonymous table access is revoked.
- Plans are validated as untrusted data. No model output is executed as code.
- UI clearly labels AI output as a proposal and does not report unexecuted tasks as verified.

## Known limitations

- Rate limits are in-memory and per serverless instance; they are not distributed.
- Authentication session tokens are held in app memory and cleared on refresh; session refresh, password reset, MFA, and a complete production account lifecycle are not implemented.
- No GitHub write integration, autonomous code execution, or isolated sandbox is implemented.
- Live database RLS tests, live provider tests, deployment smoke tests, and independent security review remain required.
- A migration file is not proof that it has been applied to the hosted Supabase project.

Never commit API keys, passwords, access tokens, or private customer data. Treat repository files, issue text, web pages, and model output as untrusted input. Do not enable repository writes, production deployments, payments, destructive actions, or outbound messages without explicit human approval and tested authorization.
