import { randomUUID } from "node:crypto";

interface RequestLike { method?: string; headers?: Record<string, string | string[] | undefined>; }
interface ResponseLike { status(code: number): ResponseLike; json(body: unknown): void; setHeader(name: string, value: string): void; }
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
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return fail(res, requestId, 405, "Use GET to load approval history."); }
  const bearer = header(req, "authorization");
  const match = typeof bearer === "string" ? /^Bearer ([A-Za-z0-9._~-]{20,4096})$/.exec(bearer) : null;
  if (!match) return fail(res, requestId, 401, "Sign in before loading approval history.");
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key || !/^https:\/\//.test(url)) return fail(res, requestId, 503, "Approval history storage is not configured.");
  try {
    const auth = await fetch(url + "/auth/v1/user", {
      headers: { apikey: key, Authorization: "Bearer " + match[1] }, signal: AbortSignal.timeout(8000),
    });
    if (!auth.ok) return fail(res, requestId, 401, "Your session is invalid or expired. Sign in again.");
    const user = await auth.json() as { id?: unknown };
    if (typeof user.id !== "string" || !/^[0-9a-f-]{36}$/i.test(user.id)) return fail(res, requestId, 401, "Could not verify your session.");
    const response = await fetch(url + "/rest/v1/office_workflow_approval_events?select=id,workflow_id,decision,from_status,to_status,created_at&order=created_at.desc&limit=100", {
      headers: { apikey: key, Authorization: "Bearer " + match[1] }, signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return fail(res, requestId, 502, "Could not load approval history. Check the approval migration and RLS policies.");
    const events = await response.json() as unknown;
    if (!Array.isArray(events)) return fail(res, requestId, 502, "Database returned an invalid approval history.");
    return res.status(200).json({ events, requestId });
  } catch {
    return fail(res, requestId, 503, "Approval history service is temporarily unavailable.");
  }
}
