export interface ArtifactGuardResult {
  passed: boolean;
  feedback: string;
}

/**
 * Deterministic safety checks for generated text artifacts.
 * This is deliberately conservative and is not a complete HTML or secret scanner.
 */
export function inspectArtifact(artifact: string): ArtifactGuardResult {
  if (!artifact.trim()) {
    return { passed: false, feedback: "Artifact is empty." };
  }
  if (artifact.length > 10000) {
    return { passed: false, feedback: "Artifact exceeds the 10000-character limit." };
  }

  const checks: Array<{ pattern: RegExp; feedback: string }> = [
    { pattern: /<\s*(?:script|iframe|object|embed|svg|math|form)\b/i, feedback: "Artifact contains active or embedded HTML markup." },
    { pattern: /\bon[a-z]{3,}\s*=/i, feedback: "Artifact contains an HTML event-handler attribute." },
    { pattern: /javascript\s*:/i, feedback: "Artifact contains a javascript: URL." },
    { pattern: /\b(?:AIza[0-9A-Za-z_-]{30,}|gh[pousr]_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|sb_secret_[A-Za-z0-9_-]{20,})\b/i, feedback: "Artifact appears to contain a provider or repository secret." },
  ];

  for (const check of checks) {
    if (check.pattern.test(artifact)) return { passed: false, feedback: check.feedback };
  }
  return { passed: true, feedback: "Deterministic artifact safety checks passed; this does not verify task correctness or external execution." };
}
