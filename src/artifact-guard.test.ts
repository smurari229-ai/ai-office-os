import { describe, expect, it } from "vitest";
import { inspectArtifact } from "./artifact-guard";

describe("deterministic artifact safety guard", () => {
  it("accepts ordinary text and Markdown without claiming correctness", () => {
    const result = inspectArtifact("# Release checklist\n\n- Confirm owner\n- Record test evidence");
    expect(result.passed).toBe(true);
    expect(result.feedback).toMatch(/does not verify task correctness/i);
  });

  it.each([
    ["script tag", "<script>alert(1)</script>"],
    ["embedded frame", "<iframe src=\"https://example.com\"></iframe>"],
    ["event handler", "<img src=x onerror=alert(1)>"],
    ["javascript URL", "[click](javascript:alert(1))"],
    ["Google API key-like secret", "AIza" + "A".repeat(35)],
    ["GitHub token-like secret", "ghp_" + "A".repeat(30)],
  ])("rejects %s", (_name, artifact) => {
    expect(inspectArtifact(artifact).passed).toBe(false);
  });

  it("rejects blank and overlong artifacts", () => {
    expect(inspectArtifact("   ").passed).toBe(false);
    expect(inspectArtifact("x".repeat(10001)).feedback).toMatch(/10000-character limit/i);
  });
});
