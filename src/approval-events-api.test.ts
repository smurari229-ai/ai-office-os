import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../api/approval-events";

function responseMock() {
  let code = 200; let body: unknown; const headers: Record<string, string> = {};
  const response = { status(value: number) { code = value; return response; }, json(value: unknown) { body = value; }, setHeader(name: string, value: string) { headers[name] = value; } };
  return { response, get code() { return code; }, get body() { return body; }, headers };
}
const token = "x".repeat(32);
function request(method: string, auth = true) { return { method, headers: auth ? { authorization: "Bearer " + token } : {} }; }

describe("GET /api/approval-events", () => {
  beforeEach(() => { vi.restoreAllMocks(); delete process.env.SUPABASE_URL; delete process.env.SUPABASE_ANON_KEY; });
  it("rejects unsupported methods", async () => { const res = responseMock(); await handler(request("POST"), res.response); expect(res.code).toBe(405); });
  it("requires a bearer session", async () => { const res = responseMock(); await handler(request("GET", false), res.response); expect(res.code).toBe(401); });
  it("returns configuration errors without network calls", async () => {
    const spy = vi.spyOn(globalThis, "fetch"); const res = responseMock(); await handler(request("GET"), res.response);
    expect(res.code).toBe(503); expect(spy).not.toHaveBeenCalled();
  });
  it("loads history only after session validation", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co"; process.env.SUPABASE_ANON_KEY = "public-test-key";
    const events = [{ id: "event-1", decision: "approve", from_status: "PROPOSED", to_status: "APPROVED" }];
    const spy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(events), { status: 200 }));
    const res = responseMock(); await handler(request("GET"), res.response);
    expect(res.code).toBe(200); expect(res.body).toMatchObject({ events });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(String(spy.mock.calls[1][0])).toContain("/office_workflow_approval_events");
    expect(String(spy.mock.calls[1][0])).toContain("limit=100");
  });
});
