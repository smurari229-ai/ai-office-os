import { randomUUID } from "node:crypto";
import { validateProposedPlan } from "../src/provider-contract.js";

interface RequestLike {
  method?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
}
interface ResponseLike {
  status(code: number): ResponseLike;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
}

const MAX_BODY_BYTES = 32_000;
const MAX_GOAL_LENGTH = 500;

function header(req: RequestLike, name: string): string | undefined {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}
function fail(res: ResponseLike, requestId: string, status: number, message: string) {
  return res.status(status).json({ error: message, requestId });
}
function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key || !/^https:\/\//.test(url)) return null;
  return { url, key };
}
async function authenticate(url: string, key: string, token: string): Promise<string | null> {
  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const user = await response.json() as { id?: unknown };
    return typeof user.id === "string" && /^[0-9a-f-]{36}$/i.test(user.id) ? user.id : null;
  } catch {
    return null;
  }
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  const requestId = randomUUID();
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Request-Id", requestId);
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return fail(res, requestId, 405, "Use GET to list your workflows or POST to save an AI plan.");
  }

  const bearer = header(req, "authorization");
  const match = typeof bearer === "string" ? /^Bearer ([A-Za-z0-9._~-]{20,4096})$/.exec(bearer) : null;
  if (!match) return fail(res, requestId, 401, "Sign in with Supabase and provide a valid access token.");

  const settings = config();
  if (!settings) return fail(res, requestId, 503, "Persistent storage is not configured. Set server-side SUPABASE_URL and SUPABASE_ANON_KEY.");
  const userId = await authenticate(settings.url, settings.key, match[1]);
  if (!userId) return fail(res, requestId, 401, "Your session is invalid or expired. Sign in again.");

  const baseHeaders = {
    apikey: settings.key,
    Authorization: `Bearer ${match[1]}`,
    "Content-Type": "application/json",
  };

  try {
    if (req.method === "GET") {
      const response = await fetch(
        `${settings.url}/rest/v1/office_workflows?select=id,goal,plan,status,created_at,updated_at&order=created_at.desc&limit=50`,
        { headers: baseHeaders, signal: AbortSignal.timeout(8_000) },
      );
      if (!response.ok) {
        console.error(JSON.stringify({ service: "office-workflows", event: "list_failed", requestId, status: response.status }));
        return fail(res, requestId, 502, "Could not load saved workflows. Check the database migration and access policies.");
      }
      return res.status(200).json({ workflows: await response.json(), requestId });
    }

    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      return fail(res, requestId, 400, "Send a JSON object containing goal and plan.");
    }
    if (Buffer.byteLength(JSON.stringify(req.body), "utf8") > MAX_BODY_BYTES) {
      return fail(res, requestId, 413, "Workflow payload is too large.");
    }
    const body = req.body as Record<string, unknown>;
    if (typeof body.goal !== "string" || !body.goal.trim() || body.goal.trim().length > MAX_GOAL_LENGTH) {
      return fail(res, requestId, 400, "Goal must contain 1–500 characters.");
    }
    let plan;
    try {
      plan = validateProposedPlan(body.plan);
    } catch {
      return fail(res, requestId, 400, "Plan is invalid; only schema-validated proposals can be saved.");
    }

    const suppliedIdempotency = header(req, "idempotency-key");
    const idempotencyKey = suppliedIdempotency && /^[A-Za-z0-9_-]{8,100}$/.test(suppliedIdempotency)
      ? suppliedIdempotency
      : randomUUID();

    const response = await fetch(`${settings.url}/rest/v1/office_workflows`, {
      method: "POST",
      headers: { ...baseHeaders, Prefer: "return=representation,resolution=ignore-duplicates" },
      body: JSON.stringify({
        goal: body.goal.trim(),
        plan,
        status: "PROPOSED",
        idempotency_key: idempotencyKey,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      console.error(JSON.stringify({ service: "office-workflows", event: "save_failed", requestId, status: response.status }));
      return fail(res, requestId, 502, "Could not save this workflow. Check database migration, RLS policies, and storage availability.");
    }
    const rows = await response.json() as unknown[];
    return res.status(201).json({ workflow: rows[0] ?? null, saved: rows.length > 0, requestId });
  } catch {
    console.error(JSON.stringify({ service: "office-workflows", event: "storage_unavailable", requestId }));
    return fail(res, requestId, 503, "Persistent storage is temporarily unavailable. Your plan was not confirmed as saved.");
  }
}
