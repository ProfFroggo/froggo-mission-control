/**
 * Credits conversion stub — local mode.
 */
export const CREDIT_MULTIPLIER = 100

export function dollarsToCredits(dollars: number): number {
  return Math.round(dollars * CREDIT_MULTIPLIER)
}

export function creditsToDollars(credits: number): number {
  return credits / CREDIT_MULTIPLIER
}

export function formatCredits(credits: number): string {
  return credits.toLocaleString()
}
