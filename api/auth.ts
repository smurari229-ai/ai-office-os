import { randomUUID } from "node:crypto";

interface RequestLike { method?: string; body?: unknown; }
interface ResponseLike {
  status(code: number): ResponseLike;
  json(body: unknown): void;
  setHeader(name: string, value: string): void;
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
    return fail(res, requestId, 405, "Use POST to sign in or create an account.");
  }
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return fail(res, requestId, 400, "Send an action, email, and password.");
  }
  if (Buffer.byteLength(JSON.stringify(req.body), "utf8") > 2_048) {
    return fail(res, requestId, 413, "Authentication request is too large.");
  }
  const body = req.body as Record<string, unknown>;
  if (body.action !== "signin" && body.action !== "signup") {
    return fail(res, requestId, 400, "Action must be signin or signup.");
  }
  if (typeof body.email !== "string" || body.email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
    return fail(res, requestId, 400, "Enter a valid email address.");
  }
  if (typeof body.password !== "string" || body.password.length < 8 || body.password.length > 128) {
    return fail(res, requestId, 400, "Password must contain 8–128 characters.");
  }
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key || !/^https:\/\//.test(url)) {
    return fail(res, requestId, 503, "Authentication is not configured. Set server-side SUPABASE_URL and SUPABASE_ANON_KEY.");
  }
  const path = body.action === "signup" ? "/auth/v1/signup" : "/auth/v1/token?grant_type=password";
  try {
    const response = await fetch(`${url}${path}`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ email: body.email.trim(), password: body.password }),
      signal: AbortSignal.timeout(8_000),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      // Do not echo provider payloads; they can contain private/account details.
      const message = response.status === 400 || response.status === 422
        ? "Sign-in failed. Check the email/password or account verification requirements."
        : response.status === 429
          ? "Too many authentication attempts. Wait and try again."
          : "Authentication provider is unavailable. Try again later.";
      return fail(res, requestId, response.status === 429 ? 429 : 401, message);
    }
    const session = payload.access_token;
    const user = payload.user;
    if (typeof session !== "string" || typeof user !== "object" || user === null ||
        typeof (user as Record<string, unknown>).id !== "string") {
      return res.status(200).json({
        pendingVerification: true,
        message: "Account request received. If email verification is enabled, verify your email before signing in.",
        requestId,
      });
    }
    return res.status(200).json({
      accessToken: session,
      user: { id: (user as Record<string, unknown>).id, email: (user as Record<string, unknown>).email },
      requestId,
    });
  } catch {
    return fail(res, requestId, 503, "Authentication provider timed out or is unavailable.");
  }
}
