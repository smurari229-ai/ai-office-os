import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../api/approve";

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
function request(method: string, body?: unknown, token?: string) {
  return { method, body, headers: token ? { authorization: `Bearer ${token}` } : {} };
}
const id = "11111111-1111-4111-8111-111111111111";
const token = "x".repeat(32);

describe("POST /api/approve", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
  });

  it("rejects non-POST methods", async () => {
    const res = responseMock();
    await handler(request("GET"), res.response);
    expect(res.code).toBe(405);
    expect(res.headers["X-Request-Id"]).toBeTruthy();
  });

  it("validates decision and workflow ID before network access", async () => {
    const spy = vi.spyOn(globalThis, "fetch");
    const res = responseMock();
    await handler(request("POST", { workflowId: "bad", decision: "execute" }, token), res.response);
    expect(res.code).toBe(400);
    expect(spy).not.toHaveBeenCalled();
  });

  it("requires an authenticated session", async () => {
    const res = responseMock();
    await handler(request("POST", { workflowId: id, decision: "approve" }), res.response);
    expect(res.code).toBe(401);
  });

  it("fails clearly when Supabase is not configured", async () => {
    const res = responseMock();
    await handler(request("POST", { workflowId: id, decision: "approve" }, token), res.response);
    expect(res.code).toBe(503);
  });

  it("returns success only when the database confirms an audited approval", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "public-test-key";
    const spy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        workflowId: id, decision: "approve", status: "APPROVED", auditRecorded: true,
      }), { status: 200 }));
    const res = responseMock();
    await handler(request("POST", { workflowId: id, decision: "approve" }, token), res.response);
    expect(res.code).toBe(200);
    expect(res.body).toMatchObject({ status: "APPROVED", auditRecorded: true });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(String(spy.mock.calls[1][0])).toContain("/rpc/decide_office_workflow");
  });

  it("does not claim approval when the database rejects the transition", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "public-test-key";
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }), { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 400 }));
    const res = responseMock();
    await handler(request("POST", { workflowId: id, decision: "approve" }, token), res.response);
    expect(res.code).toBe(409);
    expect(res.body).toMatchObject({ error: expect.stringMatching(/not applied/i) });
  });
});
