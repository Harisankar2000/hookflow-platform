import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const KEY_PREFIX = 'hf_live_';

/** A new secret API key. Only its hash is ever stored. */
export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = KEY_PREFIX + randomBytes(24).toString('base64url');
  return { key, prefix: key.slice(0, KEY_PREFIX.length + 6), hash: hashApiKey(key) };
}

export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/** Endpoint signing secret in the Standard Webhooks format: whsec_<base64 key>. */
export function generateEndpointSecret(): string {
  return 'whsec_' + randomBytes(24).toString('base64');
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
