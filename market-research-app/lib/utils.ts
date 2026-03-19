import type { BudgetRange } from "./types";

/** Format a budget range enum value to a human-readable label */
export function formatBudgetLabel(range: BudgetRange): string {
  const map: Record<BudgetRange, string> = {
    "under-10k": "Under $10,000",
    "10k-50k": "$10,000 – $50,000",
    "50k-250k": "$50,000 – $250,000",
    "250k-1m": "$250,000 – $1M",
    "over-1m": "Over $1M",
  };
  return map[range];
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Generate a lightweight random ID (not cryptographically secure) */
export function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** Merge class names (lightweight cx helper without a dependency) */
export function cx(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
