import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROVIDER_BUDGET,
  validateProposedPlan,
  validateProviderBudget,
  type ProposedPlan,
} from "./provider-contract";

const validPlan: ProposedPlan = {
  summary: "Prepare a launch",
  tasks: [{
    title: "Write checklist",
    description: "Draft launch checks",
    owner: "Manager",
    acceptanceCriteria: ["Checklist has an owner"],
  }],
};

describe("provider contract safety boundary", () => {
  it("accepts valid structured plans and drops unknown fields", () => {
    const result = validateProposedPlan({ ...validPlan, runShell: "rm -rf /" });
    expect(result).toEqual(validPlan);
    expect("runShell" in result).toBe(false);
  });

  it("rejects missing or malformed structured output", () => {
    expect(() => validateProposedPlan(null)).toThrow(/expected an object/i);
    expect(() => validateProposedPlan({ summary: "x", tasks: "not an array" })).toThrow(/tasks/i);
  });

  it("rejects excessive task counts", () => {
    expect(() => validateProposedPlan({
      summary: "Plan",
      tasks: Array.from({ length: 9 }, () => validPlan.tasks[0]),
    })).toThrow(/1–8 items/i);
  });

  it("rejects unapproved roles and empty acceptance criteria", () => {
    expect(() => validateProposedPlan({
      ...validPlan,
      tasks: [{ ...validPlan.tasks[0], owner: "Shell" }],
    })).toThrow(/unknown role/i);
    expect(() => validateProposedPlan({
      ...validPlan,
      tasks: [{ ...validPlan.tasks[0], acceptanceCriteria: [] }],
    })).toThrow(/acceptance criteria/i);
  });

  it("enforces bounded request, retry, and output-token budgets", () => {
    expect(validateProviderBudget(DEFAULT_PROVIDER_BUDGET)).toEqual(DEFAULT_PROVIDER_BUDGET);
    expect(() => validateProviderBudget({ ...DEFAULT_PROVIDER_BUDGET, maxRequests: 99 })).toThrow(/maxRequests/i);
    expect(() => validateProviderBudget({ ...DEFAULT_PROVIDER_BUDGET, maxRetries: 2 })).toThrow(/Retries/i);
  });

  it("rejects oversized and blank text fields", () => {
    expect(() => validateProposedPlan({ ...validPlan, summary: " " })).toThrow(/summary/i);
    expect(() => validateProposedPlan({ ...validPlan, summary: "x".repeat(501) })).toThrow(/summary/i);
  });
});
