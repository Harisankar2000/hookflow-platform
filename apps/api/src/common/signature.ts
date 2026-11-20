import { createHmac } from 'node:crypto';
import { safeEqual } from './crypto';

/**
 * Signs a webhook the way the Standard Webhooks spec does:
 * base64(HMAC-SHA256(secret, `${msgId}.${timestamp}.${body}`)), sent as `v1,<signature>`.
 * Receivers recompute it and reject old timestamps, which blocks replayed requests.
 */
export function signPayload(secret: string, msgId: string, timestamp: number, body: string): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const digest = createHmac('sha256', key).update(`${msgId}.${timestamp}.${body}`).digest('base64');
  return `v1,${digest}`;
}

export function verifySignature(
  secret: string,
  msgId: string,
  timestamp: number,
  body: string,
  header: string,
  toleranceSeconds = 300,
  now = Math.floor(Date.now() / 1000),
): boolean {
  if (Math.abs(now - timestamp) > toleranceSeconds) return false;
  const expected = signPayload(secret, msgId, timestamp, body);
  // The header may carry several space-separated signatures during secret rotation.
  return header.split(' ').some((candidate) => safeEqual(candidate, expected));
}
