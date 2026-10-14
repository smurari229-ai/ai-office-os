import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../api/auth";

function request(body: unknown, method = "POST") { return { method, body }; }
function responseMock() {
  let code = 200;
  let body: unknown;
  const headers: Record<string, string> = {};
  const response = {
    status(value: number) { code = value; return response; },
    json(value: unknown) { body = value; },
    setHeader(name: string, value: string) { headers[name] = value; },
  };
  return { response, get code() { return code; }, get body() { return body; }, headers };
}

describe("Supabase authentication API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
  });

  it("rejects non-POST methods", async () => {
    const res = responseMock();
    await handler(request({}, "GET"), res.response);
    expect(res.code).toBe(405);
    expect(res.headers["Cache-Control"]).toBe("no-store");
  });

  it("validates email and password before calling Supabase", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "public-test-key";
    const spy = vi.spyOn(globalThis, "fetch");
    const res = responseMock();
    await handler(request({ action: "signin", email: "bad", password: "123" }), res.response);
    expect(res.code).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns a clear configuration error without a Supabase project", async () => {
    const res = responseMock();
    await handler(request({ action: "signin", email: "person@example.com", password: "long-enough-password" }), res.response);
    expect(res.code).toBe(503);
    expect(res.body).toMatchObject({ error: expect.stringContaining("SUPABASE_URL") });
  });

  it("returns a short-lived client session only when Supabase returns one", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "public-test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      access_token: "session-token-for-test",
      user: { id: "11111111-1111-4111-8111-111111111111", email: "person@example.com" },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const res = responseMock();
    await handler(request({ action: "signin", email: "person@example.com", password: "long-enough-password" }), res.response);
    expect(res.code).toBe(200);
    expect(res.body).toMatchObject({ accessToken: "session-token-for-test", user: { email: "person@example.com" } });
  });

  it("does not expose provider errors or response payloads", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "public-test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      message: "private-provider-error-with-account-details",
    }), { status: 401, headers: { "Content-Type": "application/json" } }));
    const res = responseMock();
    await handler(request({ action: "signin", email: "person@example.com", password: "long-enough-password" }), res.response);
    expect(res.code).toBe(401);
    expect(JSON.stringify(res.body)).not.toContain("private-provider-error");
  });
});
