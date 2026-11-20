import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verifies a HookFlow (Standard Webhooks) signature. Copy this into your own service.
 * Signed content is `${webhook-id}.${webhook-timestamp}.${rawBody}`, HMAC-SHA256 with the
 * base64 key after "whsec_". Old timestamps are rejected so captured requests can't be replayed.
 */
export function verifyWebhook(secret, headers, rawBody, { toleranceSeconds = 300, now = Date.now() } = {}) {
  const id = headers['webhook-id'];
  const timestamp = Number(headers['webhook-timestamp']);
  const signatures = String(headers['webhook-signature'] ?? '').split(' ');
  if (!id || !Number.isFinite(timestamp)) return false;
  if (Math.abs(Math.floor(now / 1000) - timestamp) > toleranceSeconds) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = Buffer.from(
    'v1,' + createHmac('sha256', key).update(`${id}.${timestamp}.${rawBody}`).digest('base64'),
  );
  return signatures.some((candidate) => {
    const given = Buffer.from(candidate);
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
