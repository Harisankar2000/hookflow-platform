import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { verifyWebhook } from './verify.mjs';

const secret = 'whsec_' + Buffer.from('test-secret-key-123').toString('base64');
const body = JSON.stringify({ id: 'msg_1', type: 'payment.succeeded', data: { amount: 499 } });
const now = 1_760_000_000_000;
const ts = Math.floor(now / 1000);

function sign(id, timestamp, raw) {
  const key = Buffer.from(secret.slice(6), 'base64');
  return 'v1,' + createHmac('sha256', key).update(`${id}.${timestamp}.${raw}`).digest('base64');
}

const headers = (overrides = {}) => ({
  'webhook-id': 'msg_1',
  'webhook-timestamp': String(ts),
  'webhook-signature': sign('msg_1', ts, body),
  ...overrides,
});

test('accepts a valid signature', () => {
  assert.equal(verifyWebhook(secret, headers(), body, { now }), true);
});

test('rejects a modified body', () => {
  assert.equal(verifyWebhook(secret, headers(), body.replace('499', '1'), { now }), false);
});

test('rejects an old timestamp', () => {
  assert.equal(verifyWebhook(secret, headers(), body, { now: now + 10 * 60_000 }), false);
});

test('accepts any of several signatures during secret rotation', () => {
  const sig = `v1,bm90LXRoZS1yaWdodC1vbmU= ${sign('msg_1', ts, body)}`;
  assert.equal(verifyWebhook(secret, headers({ 'webhook-signature': sig }), body, { now }), true);
});
