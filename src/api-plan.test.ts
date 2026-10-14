import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../api/plan";

function makeRequest(body: unknown, method = "POST") {
  return { method, body, socket: { remoteAddress: `test-client-${Math.random()}` }, headers: {} };
}

function makeResponse() {
  let statusCode = 200;
  const headers: Record<string, string> = {};
  let body: unknown;
  const response = {
    status(code: number) { statusCode = code; return response; },
    json(value: unknown) { body = value; },
    setHeader(name: string, value: string) { headers[name] = value; },
  };
  return { response, get statusCode() { return statusCode; }, get headers() { return headers; }, get body() { return body; } };
}

describe("POST /api/plan", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
  });

  it("rejects methods other than POST and returns a request ID", async () => {
    const res = makeResponse();
    await handler(makeRequest({}, "GET"), res.response);
    expect(res.statusCode).toBe(405);
    expect(res.headers["X-Request-Id"]).toBeTruthy();
    expect(res.body).toMatchObject({ error: expect.stringMatching(/POST/i) });
  });

  it("rejects invalid goals before making a provider request", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const res = makeResponse();
    await handler(makeRequest({ goal: " " }), res.response);
    expect(res.statusCode).toBe(400);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({ requestId: res.headers["X-Request-Id"] });
  });

  it("reports missing server credentials rather than fabricating a plan", async () => {
    const res = makeResponse();
    await handler(makeRequest({ goal: "Plan a safe release" }), res.response);
    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({ error: expect.stringContaining("GEMINI_API_KEY") });
  });

  it("returns only schema-validated plans from a real provider response", async () => {
    process.env.GEMINI_API_KEY = "unit-test-key";
    const plan = {
      summary: "Prepare a safe release.",
      tasks: [{
        title: "Define release criteria",
        description: "Write verifiable release requirements.",
        owner: "Boss",
        acceptanceCriteria: ["A reviewer approves the criteria."],
      }],
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(plan) }] } }],
      usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50, totalTokenCount: 150 },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));

    const res = makeResponse();
    await handler(makeRequest({ goal: "Plan a safe release" }), res.response);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ plan, mode: "ai", requestId: res.headers["X-Request-Id"] });
  });

  it("rejects malformed provider output", async () => {
    process.env.GEMINI_API_KEY = "unit-test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ summary: "Invalid", tasks: [{ title: "x", description: "y", owner: "Root", acceptanceCriteria: ["no"] }] }) }] } }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const res = makeResponse();
    await handler(makeRequest({ goal: "Plan a safe release" }), res.response);
    expect(res.statusCode).toBe(502);
    expect(res.body).toMatchObject({ error: expect.stringMatching(/provider|plan/i) });
  });
});
