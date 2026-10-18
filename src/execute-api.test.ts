import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../api/execute";
function responseMock() {
  let code = 200; let body: unknown; const headers: Record<string, string> = {};
  const response = { status(value: number) { code = value; return response; }, json(value: unknown) { body = value; }, setHeader(name: string, value: string) { headers[name] = value; } };
  return { response, get code() { return code; }, get body() { return body; }, headers };
}
function request(method: string, body?: unknown, token?: string) {
  return { method, body, headers: token ? { authorization: "Bearer " + token } : {} };
}
const id = "11111111-1111-4111-8111-111111111111";
const token = "x".repeat(32);
const plan = { summary: "Create a checklist", tasks: [{ title: "Draft release checklist", description: "Create a concise release checklist.", owner: "Developer", acceptanceCriteria: ["Includes build verification", "Includes rollback steps"] }] };
describe("POST /api/execute", () => {
  beforeEach(() => { vi.restoreAllMocks(); delete process.env.SUPABASE_URL; delete process.env.SUPABASE_ANON_KEY; delete process.env.GEMINI_API_KEY; delete process.env.GEMINI_MODEL; });
  it("rejects invalid requests before network access", async () => {
    const spy = vi.spyOn(globalThis, "fetch"); const res = responseMock();
    await handler(request("POST", { workflowId: "bad", taskIndex: 0 }, token), res.response);
    expect(res.code).toBe(400); expect(spy).not.toHaveBeenCalled();
  });
  it("requires a valid session", async () => {
    const res = responseMock(); await handler(request("POST", { workflowId: id, taskIndex: 0 }), res.response); expect(res.code).toBe(401);
  });
  it("does not generate artifacts until the saved workflow is approved", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co"; process.env.SUPABASE_ANON_KEY = "public-test-key"; process.env.GEMINI_API_KEY = "unit-test-key";
    const spy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id, goal: "goal", plan, status: "PROPOSED" }]), { status: 200 }));
    const res = responseMock(); await handler(request("POST", { workflowId: id, taskIndex: 0 }, token), res.response);
    expect(res.code).toBe(409); expect(spy).toHaveBeenCalledTimes(2);
  });
  it("generates, QA-checks, and records an approved artifact", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co"; process.env.SUPABASE_ANON_KEY = "public-test-key"; process.env.GEMINI_API_KEY = "unit-test-key";
    const spy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id, goal: "Prepare a release", plan, status: "APPROVED" }]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ artifact: "- Verify build\n- Prepare rollback", summary: "Drafted release checklist" }) }] }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ passed: true, feedback: "Both criteria are represented in the draft." }) }] }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ runId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", status: "QA_PASSED" }), { status: 200 }));
    const res = responseMock(); await handler(request("POST", { workflowId: id, taskIndex: 0 }, token), res.response);
    expect(res.code).toBe(200); expect(res.body).toMatchObject({ taskIndex: 0, qa: { passed: true }, run: { status: "QA_PASSED" }, externalActionsPerformed: false });
    expect(spy).toHaveBeenCalledTimes(5); expect(String(spy.mock.calls[4][0])).toContain("/rpc/record_office_task_run");
  });
});
