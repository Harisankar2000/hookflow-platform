import { maxAttempts, nextRetryDelay } from './backoff';

describe('nextRetryDelay', () => {
  const schedule = [1000, 5000, 30000];

  it('follows the schedule without jitter at the midpoint', () => {
    expect(nextRetryDelay(schedule, 1, () => 0.5)).toBe(1000);
    expect(nextRetryDelay(schedule, 3, () => 0.5)).toBe(30000);
  });

  it('keeps jitter within plus or minus 20 percent', () => {
    expect(nextRetryDelay(schedule, 2, () => 0)).toBe(4000);
    expect(nextRetryDelay(schedule, 2, () => 0.999999)).toBe(6000);
  });

  it('returns null once retries are used up', () => {
    expect(nextRetryDelay(schedule, 4)).toBeNull();
    expect(maxAttempts(schedule)).toBe(4);
  });
});
