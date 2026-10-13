# Real AI planning setup

AI Office OS includes an optional server-side Gemini planning endpoint. The browser never receives the Gemini key. The endpoint only creates a proposed task plan; it does not execute code, edit a repository, deploy, send messages, or make purchases.

## Configure Vercel

1. Open the Vercel project **ai-office-os** and go to **Settings → Environment Variables**.
2. Add `GEMINI_API_KEY` with your own Google AI Studio API key. Keep it server-side: do **not** use a `VITE_` prefix and do not put the value in GitHub files or chat.
3. Optionally add `GEMINI_MODEL` with a supported Gemini model ID. If omitted, the API uses `gemini-2.5-flash`.
4. Apply the variables to the Preview environment first, then redeploy the feature-branch preview.
5. Open the preview, enter a goal, and choose **Create AI plan**. A successful response is labelled **AI PLAN**. **Try demo** remains available without an API key.
6. If the provider returns a configuration or quota error, check the Vercel function logs and your Google AI project quota. API usage may have costs or limits; configure provider budget alerts before using this publicly.

## API behavior and safety

- `POST /api/plan` accepts a JSON object containing a 1–500 character goal.
- The server caps generated output, times out provider requests, rejects malformed model output, validates role names and text lengths, and applies a best-effort per-instance rate limit.
- Provider errors are returned without exposing the API key or raw provider response.
- Model output is treated as untrusted data and is validated again in the browser.
- The output is a proposal only. Task completion remains unverified until real evidence is collected.
- The in-memory rate limit is best-effort, not a substitute for a durable distributed quota or authenticated access. Before opening this endpoint to broad public traffic, add durable abuse controls and billing limits.
- Never paste API keys into GitHub issues, commits, screenshots, or this chat.

## Verification

CI runs the UI typecheck/build, API TypeScript typecheck, unit tests, and npm dependency audit. The model-backed path requires a valid `GEMINI_API_KEY`; without it the endpoint intentionally returns HTTP 503 and the local demo still works.
