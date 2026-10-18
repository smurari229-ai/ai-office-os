import { randomUUID } from "node:crypto";
interface RequestLike { method?: string; headers?: Record<string, string | string[] | undefined>; }
interface ResponseLike { status(code: number): ResponseLike; json(body: unknown): void; setHeader(name: string, value: string): void; }
function fail(res: ResponseLike, requestId: string, status: number, message: string) {
  return res.status(status).json({ error: message, requestId });
}
function header(req: RequestLike, name: string): string | undefined {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}
export default async function handler(req: RequestLike, res: ResponseLike) {
  const requestId = randomUUID();
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Request-Id", requestId);
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return fail(res, requestId, 405, "Use GET to load your saved task artifacts."); }
  const bearer = header(req, "authorization");
  const match = typeof bearer === "string" ? /^Bearer ([A-Za-z0-9._~-]{20,4096})$/.exec(bearer) : null;
  if (!match) return fail(res, requestId, 401, "Sign in before loading task artifacts.");
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key || !/^https:\/\//.test(url)) return fail(res, requestId, 503, "Task storage is not configured.");
  try {
    const auth = await fetch(url + "/auth/v1/user", {
      headers: { apikey: key, Authorization: "Bearer " + match[1] }, signal: AbortSignal.timeout(8000),
    });
    if (!auth.ok) return fail(res, requestId, 401, "Your session is invalid or expired. Sign in again.");
    const user = await auth.json() as { id?: unknown };
    if (typeof user.id !== "string" || !/^[0-9a-f-]{36}$/i.test(user.id)) return fail(res, requestId, 401, "Could not verify your session.");
    const response = await fetch(url + "/rest/v1/office_workflow_task_runs?select=id,workflow_id,task_index,task_title,artifact,qa_passed,qa_feedback,status,attempt,created_at,updated_at&order=updated_at.desc&limit=100", {
      headers: { apikey: key, Authorization: "Bearer " + match[1] }, signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return fail(res, requestId, 502, "Could not load saved task artifacts. Check the task-run migration and RLS.");
    const runs = await response.json() as unknown;
    if (!Array.isArray(runs)) return fail(res, requestId, 502, "Database returned an invalid task-run list.");
    return res.status(200).json({ runs, requestId });
  } catch {
    return fail(res, requestId, 503, "Task-run storage is temporarily unavailable.");
  }
}
