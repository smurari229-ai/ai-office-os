import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../api/tasks";

function request(method: string, body?: unknown, token?: string) {
  return {
    method, body,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  };
}
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

describe("authenticated persistent workflow API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_ANON_KEY;
  });

  it("rejects unsupported methods", async () => {
    const res = responseMock();
    await handler(request("DELETE"), res.response);
    expect(res.code).toBe(405);
    expect(res.headers["X-Request-Id"]).toBeTruthy();
  });

  it("requires a bearer session", async () => {
    const res = responseMock();
    await handler(request("GET"), res.response);
    expect(res.code).toBe(401);
    expect(res.body).toMatchObject({ error: expect.stringMatching(/sign in/i) });
  });

  it("returns a clear error when persistence is not configured", async () => {
    const res = responseMock();
    await handler(request("GET", undefined, "x".repeat(32)), res.response);
    expect(res.code).toBe(503);
    expect(res.body).toMatchObject({ error: expect.stringContaining("SUPABASE_URL") });
  });

  it("rejects expired sessions without calling database REST endpoints", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "public-test-key";
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 401 }));
    const res = responseMock();
    await handler(request("GET", undefined, "x".repeat(32)), res.response);
    expect(res.code).toBe(401);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0][0])).toContain("/auth/v1/user");
  });

  it("rejects invalid workflow payloads before writing to storage", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "public-test-key";
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "11111111-1111-4111-8111-111111111111" }), { status: 200 }))
      .mockResolvedValueOnce(new Response("[]", { status: 200 }));
    const res = responseMock();
    await handler(request("POST", { goal: "goal", plan: { summary: "invalid", tasks: [] } }, "x".repeat(32)), res.response);
    expect(res.code).toBe(400);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("persists only validated plans with the user's bearer token", async () => {
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_ANON_KEY = "public-test-key";
    const plan = {
      summary: "Prepare a release",
      tasks: [{
        title: "Review requirements",
        description: "Write testable requirements",
        owner: "Boss",
        acceptanceCriteria: ["A reviewer approves the requirements"],
      }],
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "11111111-1111-4111-8111-111111111111" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: "workflow-1", goal: "Prepare release", plan, status: "PROPOSED" }]), { status: 201 }));
    const res = responseMock();
    await handler(request("POST", { goal: "Prepare release", plan }, "x".repeat(32)), res.response);
    expect(res.code).toBe(201);
    expect(res.body).toMatchObject({ saved: true, workflow: { id: "workflow-1", status: "PROPOSED" } });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[1][1]).toMatchObject({
      method: "POST",
      headers: expect.objectContaining({ Authorization: `Bearer ${"x".repeat(32)}` }),
    });
  });
});
