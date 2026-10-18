import { randomUUID } from "node:crypto";

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

function header(req: RequestLike, name: string): string | undefined {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}
function fail(res: ResponseLike, requestId: string, status: number, message: string) {
  return res.status(status).json({ error: message, requestId });
}

export default async function handler(req: RequestLike, res: ResponseLike) {
  const requestId = randomUUID();
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Request-Id", requestId);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return fail(res, requestId, 405, "Use POST to approve or reject a workflow proposal.");
  }
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return fail(res, requestId, 400, "Send workflowId and decision.");
  }
  if (Buffer.byteLength(JSON.stringify(req.body), "utf8") > 2_048) {
    return fail(res, requestId, 413, "Approval request is too large.");
  }

  const body = req.body as Record<string, unknown>;
  if (typeof body.workflowId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.workflowId)) {
    return fail(res, requestId, 400, "workflowId must be a valid UUID.");
  }
  if (body.decision !== "approve" && body.decision !== "reject") {
    return fail(res, requestId, 400, "decision must be approve or reject.");
  }

  const bearer = header(req, "authorization");
  const match = typeof bearer === "string"
    ? /^Bearer ([A-Za-z0-9._~-]{20,4096})$/.exec(bearer)
    : null;
  if (!match) return fail(res, requestId, 401, "Sign in before deciding on a workflow.");

  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key || !/^https:\/\//.test(url)) {
    return fail(res, requestId, 503, "Approval audit is not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY server-side.");
  }

  try {
    const authResponse = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${match[1]}` },
      signal: AbortSignal.timeout(8_000),
    });
    if (!authResponse.ok) return fail(res, requestId, 401, "Your session is invalid or expired. Sign in again.");
    const user = await authResponse.json() as { id?: unknown };
    if (typeof user.id !== "string" || !/^[0-9a-f-]{36}$/i.test(user.id)) {
      return fail(res, requestId, 401, "Could not verify your user session.");
    }

    const rpcResponse = await fetch(`${url}/rest/v1/rpc/decide_office_workflow`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${match[1]}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_workflow_id: body.workflowId, p_decision: body.decision }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!rpcResponse.ok) {
      // Do not echo database/provider payloads; they may expose implementation details.
      const status = rpcResponse.status === 401 || rpcResponse.status === 403 ? 403
        : rpcResponse.status === 404 ? 404
        : rpcResponse.status === 409 ? 409
        : 409;
      return fail(res, requestId, status, "Decision was not applied. The workflow may not belong to you, may already have a decision, or the approval migration is not installed.");
    }
    const result = await rpcResponse.json() as Record<string, unknown>;
    if (!result || result.auditRecorded !== true ||
        !["APPROVED", "CANCELLED"].includes(String(result.status))) {
      return fail(res, requestId, 502, "The database did not confirm an audited decision.");
    }
    return res.status(200).json({ ...result, requestId });
  } catch {
    return fail(res, requestId, 503, "Approval service timed out or is unavailable. No successful decision was confirmed.");
  }
}
