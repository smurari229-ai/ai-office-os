/**
 * Safe boundary for future model providers.
 *
 * This module deliberately does not make network requests or read secrets.
 * Providers must return untrusted data which is validated before use.
 */
export const MAX_PLAN_TASKS = 8;
export const MAX_TEXT_LENGTH = 500;
export const MAX_PROVIDER_ATTEMPTS = 2;

export type ProviderRole = "Boss" | "Manager" | "Developer" | "QA";

export interface ProposedTask {
  title: string;
  description: string;
  owner: ProviderRole;
  acceptanceCriteria: string[];
}

export interface ProposedPlan {
  summary: string;
  tasks: ProposedTask[];
}

export interface ProviderBudget {
  /** Maximum provider requests for one user goal. */
  maxRequests: number;
  /** Maximum retries after the initial request. */
  maxRetries: number;
  /** Optional hard cap for output tokens when supported by a provider. */
  maxOutputTokens: number;
}

export const DEFAULT_PROVIDER_BUDGET: Readonly<ProviderBudget> = Object.freeze({
  maxRequests: 2,
  maxRetries: 1,
  maxOutputTokens: 1200,
});

const ROLES = new Set<ProviderRole>(["Boss", "Manager", "Developer", "QA"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedText(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`Invalid plan: ${field} must be text.`);
  const text = value.trim();
  if (!text || text.length > MAX_TEXT_LENGTH) {
    throw new Error(`Invalid plan: ${field} must contain 1–${MAX_TEXT_LENGTH} characters.`);
  }
  return text;
}

/**
 * Validate JSON-like provider output. Never execute or trust model-generated
 * instructions as code. Unknown fields are discarded.
 */
export function validateProposedPlan(input: unknown): ProposedPlan {
  if (!isRecord(input)) throw new Error("Invalid plan: expected an object.");

  const summary = boundedText(input.summary, "summary");
  if (!Array.isArray(input.tasks) || input.tasks.length < 1 || input.tasks.length > MAX_PLAN_TASKS) {
    throw new Error(`Invalid plan: tasks must contain 1–${MAX_PLAN_TASKS} items.`);
  }

  const tasks = input.tasks.map((raw, index): ProposedTask => {
    if (!isRecord(raw)) throw new Error(`Invalid plan: task ${index + 1} must be an object.`);
    const title = boundedText(raw.title, `task ${index + 1} title`);
    const description = boundedText(raw.description, `task ${index + 1} description`);
    if (typeof raw.owner !== "string" || !ROLES.has(raw.owner as ProviderRole)) {
      throw new Error(`Invalid plan: task ${index + 1} has an unknown role.`);
    }
    if (!Array.isArray(raw.acceptanceCriteria) || raw.acceptanceCriteria.length < 1 || raw.acceptanceCriteria.length > 5) {
      throw new Error(`Invalid plan: task ${index + 1} needs 1–5 acceptance criteria.`);
    }
    const acceptanceCriteria = raw.acceptanceCriteria.map((criterion, criterionIndex) =>
      boundedText(criterion, `task ${index + 1} criterion ${criterionIndex + 1}`),
    );
    return { title, description, owner: raw.owner as ProviderRole, acceptanceCriteria };
  });

  return { summary, tasks };
}

export function validateProviderBudget(input: ProviderBudget): ProviderBudget {
  const values = [input.maxRequests, input.maxRetries, input.maxOutputTokens];
  if (!values.every(Number.isSafeInteger)) throw new Error("Provider budgets must be whole numbers.");
  if (input.maxRequests < 1 || input.maxRequests > 5) throw new Error("maxRequests must be between 1 and 5.");
  if (input.maxRetries < 0 || input.maxRetries > 2) throw new Error("maxRetries must be between 0 and 2.");
  if (input.maxRetries >= input.maxRequests) throw new Error("Retries must be fewer than total requests.");
  if (input.maxOutputTokens < 1 || input.maxOutputTokens > 4000) throw new Error("maxOutputTokens must be between 1 and 4000.");
  return { ...input };
}

/** Minimal future adapter interface; implementation must be explicitly configured. */
export interface ModelProvider {
  readonly name: string;
  proposePlan(goal: string, budget: ProviderBudget): Promise<unknown>;
}
