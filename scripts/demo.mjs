#!/usr/bin/env node
/**
 * Fills a running HookFlow with a realistic workload so the dashboard has something to show.
 * Needs the API (npm run dev:api) and the demo receiver (npm run dev:receiver).
 *
 *   API_URL=http://localhost:3200 ADMIN_TOKEN=change-me-admin-token npm run demo
 *   DEMO_MESSAGES=80 DEMO_FOLLOW=1 npm run demo   # keep publishing one event every few seconds
 */
import { writeFileSync } from 'node:fs';

const API = (process.env.API_URL ?? 'http://localhost:3200').replace(/\/$/, '');
const ADMIN = process.env.ADMIN_TOKEN ?? 'change-me-admin-token';
const RECEIVER = (process.env.RECEIVER_URL ?? 'http://localhost:4200').replace(/\/$/, '');
const COUNT = Number(process.env.DEMO_MESSAGES ?? 60);
const FOLLOW = process.env.DEMO_FOLLOW === '1';

let key = '';
async function call(method, path, body, headers = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json)}`);
  return json;
}

const eventTypes = [
  ['payment.succeeded', 'A payment was captured', { paymentId: 'pay_9xK2', amount: 2499, currency: 'INR' }],
  ['payment.failed', 'A payment attempt failed', { paymentId: 'pay_7Lm1', reason: 'insufficient_funds' }],
  ['order.created', 'A customer placed an order', { orderId: 'ord_1042', items: 3, total: 5997 }],
  ['order.shipped', 'An order left the warehouse', { orderId: 'ord_1042', carrier: 'BlueDart' }],
  ['user.registered', 'A new user signed up', { userId: 'usr_311', plan: 'free' }],
  ['subscription.renewed', 'A subscription renewed', { subscriptionId: 'sub_88', plan: 'pro', period: 'monthly' }],
];

const applications = [
  {
    name: 'Payments',
    uid: 'payments',
    endpoints: [
      ['/ok', 'Ledger service', ['payment.succeeded', 'payment.failed']],
      ['/flaky', 'Fraud screening (flaky)', ['payment.succeeded']],
      ['/status/429', 'Partner bank (rate limited)', ['payment.failed']],
    ],
  },
  {
    name: 'Orders',
    uid: 'orders',
    endpoints: [
      ['/ok', 'Warehouse', ['order.created']],
      ['/slow', 'Analytics (slow)', []],
      ['/down', 'Legacy CRM (down)', ['order.shipped']],
    ],
  },
  { name: 'Users', uid: 'users', endpoints: [['/ok', 'Email onboarding', ['user.registered']]] },
  {
    name: 'Billing',
    uid: 'billing',
    endpoints: [
      ['/ok', 'Invoices', ['subscription.renewed']],
      ['/flaky', 'Slack alerts (flaky)', []],
    ],
  },
];

const appForEvent = {
  payment: 'payments',
  order: 'orders',
  user: 'users',
  subscription: 'billing',
};

function randomEvent(i) {
  const [name, , example] = eventTypes[i % eventTypes.length];
  const app = appForEvent[name.split('.')[0]];
  return { app, eventType: name, payload: { ...example, sequence: i, at: new Date().toISOString() } };
}

async function main() {
  const created = await call('POST', '/v1/organizations', { name: 'Acme Corp' }, { 'x-admin-token': ADMIN });
  key = created.apiKey;
  writeFileSync(new URL('../apps/api/.demo-key', import.meta.url), key + '\n');

  for (const [name, description, schemaExample] of eventTypes) {
    await call('POST', '/v1/event-types', { name, description, schemaExample });
  }
  for (const app of applications) {
    await call('POST', '/v1/applications', { name: app.name, uid: app.uid });
    for (const [path, description, filterTypes] of app.endpoints) {
      await call('POST', '/v1/endpoints', { applicationId: app.uid, url: RECEIVER + path, description, filterTypes });
    }
  }

  for (let i = 0; i < COUNT; i++) {
    const { app, eventType, payload } = randomEvent(i);
    await call('POST', `/v1/applications/${app}/messages`, { eventType, payload, idempotencyKey: `demo-${i}` });
  }

  console.log(`\nDemo organization "Acme Corp" is ready with ${COUNT} messages.`);
  console.log(`Dashboard API key (also saved to apps/api/.demo-key):\n\n  ${key}\n`);

  if (FOLLOW) {
    console.log('Publishing one event every 4 seconds. Ctrl+C to stop.');
    let i = COUNT;
    setInterval(() => {
      const { app, eventType, payload } = randomEvent(i++);
      call('POST', `/v1/applications/${app}/messages`, { eventType, payload }).catch((e) => console.error(e.message));
    }, 4000);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
