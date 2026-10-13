import { describe, expect, it } from "vitest";
import { planGoal, runDemoStep, summarizeRun } from "./workflow";

describe("AI Office demo workflow", () => {
  it("rejects blank goals", () => {
    expect(() => planGoal("   ")).toThrow(/enter a goal/i);
  });

  it("rejects goals over the configured limit", () => {
    expect(() => planGoal("x".repeat(501))).toThrow(/500 characters/i);
  });

  it("creates a bounded plan with four role-owned tasks", () => {
    const run = planGoal("Prepare a launch checklist", new Date("2026-01-01T00:00:00Z"));
    expect(run.tasks).toHaveLength(4);
    expect(run.tasks.map((task) => task.owner)).toEqual(["Boss", "Manager", "Developer", "QA"]);
    expect(summarizeRun(run).queued).toBe(4);
  });

  it("does not falsely mark simulated QA as passed", () => {
    let run = planGoal("Prepare a launch checklist");
    run = runDemoStep(run);
    run = runDemoStep(run);
    run = runDemoStep(run);
    run = runDemoStep(run);
    expect(run.tasks[3].status).toBe("blocked");
    expect(run.tasks[3].detail).toMatch(/no application or external checks were executed/i);
  });
});
