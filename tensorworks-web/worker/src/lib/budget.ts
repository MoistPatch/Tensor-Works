import { redis } from "./redis.js";
import { logger } from "./logger.js";

const MONTHLY_BUDGET_AUD = Number(process.env.MONTHLY_AI_BUDGET_AUD ?? "500");

// Budget halt thresholds
const THRESHOLD_WARN = 0.9;
const THRESHOLD_PAUSE_DEEP = 0.95;
const THRESHOLD_HALT = 1.0;

export type BudgetStatus = "ok" | "warn" | "pause_deep" | "halt";

export class BudgetExceededError extends Error {
  constructor(
    public readonly status: BudgetStatus,
    public readonly spend: number,
    public readonly budget: number
  ) {
    super(
      `Budget exceeded: status=${status}, spend=${spend.toFixed(2)}, budget=${budget.toFixed(2)}`
    );
    this.name = "BudgetExceededError";
  }
}

function budgetKey(): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `budget:spend:${yyyy}-${mm}`;
}

/**
 * Record AI spend in AUD for the current month.
 * Uses a Redis float increment so concurrent workers are safe.
 */
export async function recordSpend(costAud: number): Promise<void> {
  const key = budgetKey();
  await redis.incrbyfloat(key, costAud);
  // Set expiry to ~35 days so old keys self-clean
  await redis.expire(key, 60 * 60 * 24 * 35);
  logger.info({ costAud, key }, "Recorded AI spend");
}

/**
 * Return total AI spend (AUD) for the current calendar month.
 */
export async function getMonthlySpend(): Promise<number> {
  const raw = await redis.get(budgetKey());
  return raw ? Number(raw) : 0;
}

/**
 * Return the current budget status based on spend vs. monthly budget.
 */
export async function getBudgetStatus(): Promise<BudgetStatus> {
  const spend = await getMonthlySpend();
  const ratio = spend / MONTHLY_BUDGET_AUD;

  if (ratio >= THRESHOLD_HALT) return "halt";
  if (ratio >= THRESHOLD_PAUSE_DEEP) return "pause_deep";
  if (ratio >= THRESHOLD_WARN) return "warn";
  return "ok";
}

// Which tiers are blocked at each budget status
const BLOCKED_BY_STATUS: Record<BudgetStatus, string[]> = {
  ok: [],
  warn: [],
  // At 95%+ pause all deep analysis
  pause_deep: ["deep-analysis"],
  // At 100% halt everything
  halt: ["daily-scan", "weekly-digest", "deep-analysis"],
};

/**
 * Check whether the given job tier is permitted to proceed.
 * Throws BudgetExceededError if it should not run.
 */
export async function checkBudget(
  tier: "daily-scan" | "weekly-digest" | "deep-analysis"
): Promise<void> {
  const spend = await getMonthlySpend();
  const status = await getBudgetStatus();
  const blocked = BLOCKED_BY_STATUS[status];

  if (blocked.includes(tier)) {
    logger.warn(
      { tier, status, spend, budget: MONTHLY_BUDGET_AUD },
      "Budget check failed — job will not proceed"
    );
    throw new BudgetExceededError(status, spend, MONTHLY_BUDGET_AUD);
  }

  if (status === "warn") {
    logger.warn(
      { tier, status, spend, budget: MONTHLY_BUDGET_AUD },
      "Budget warning threshold reached (90%)"
    );
  }
}
