/**
 * Delay before the next attempt, or null when retries are used up.
 * `schedule[n]` is the wait after attempt n+1 fails, so a schedule of length k gives k + 1 attempts.
 * Up to ±20% jitter spreads retries out so a recovering endpoint is not hit all at once.
 */
export function nextRetryDelay(
  schedule: number[],
  completedAttempt: number,
  random: () => number = Math.random,
): number | null {
  const base = schedule[completedAttempt - 1];
  if (base === undefined) return null;
  const jitter = 1 + (random() * 0.4 - 0.2);
  return Math.round(base * jitter);
}

export const maxAttempts = (schedule: number[]) => schedule.length + 1;
