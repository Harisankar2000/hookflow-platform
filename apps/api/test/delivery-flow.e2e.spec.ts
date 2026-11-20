/**
 * End to end against real PostgreSQL and Redis: publish, signed delivery, retries,
 * dead-lettering, replay and idempotency. Needs DATABASE_URL and REDIS_URL
 * (docker compose up -d postgres redis, then prisma migrate deploy).
 */
import { INestApplication } from '@nestjs/common';
import { createServer, IncomingHttpHeaders, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import request from 'supertest';

process.env.RETRY_SCHEDULE_MS = '200,200';
process.env.RUN_WORKER_IN_API = 'true';
process.env.ADMIN_TOKEN = 'e2e-admin-token';
process.env.LOG_LEVEL = 'warn';

jest.setTimeout(30_000);

interface Received {
  path: string;
  headers: IncomingHttpHeaders;
  body: string;
}

const waitFor = async <T>(fn: () => Promise<T | undefined>, timeoutMs = 10_000): Promise<T> => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = await fn();
    if (value !== undefined) return value;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Timed out waiting for condition');
};

describe('delivery flow (e2e)', () => {
  let app: INestApplication;
  let receiver: Server;
  let receiverUrl: string;
  let apiKey: string;
  const received: Received[] = [];

  beforeAll(async () => {
    receiver = createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        received.push({ path: req.url ?? '', headers: req.headers, body });
        res.statusCode = req.url === '/down' ? 500 : 200;
        res.end('{}');
      });
    });
    await new Promise<void>((r) => receiver.listen(0, '127.0.0.1', r));
    receiverUrl = `http://127.0.0.1:${(receiver.address() as AddressInfo).port}`;

    // Imported after the env above so the modules read the test configuration.
    const { Test } = await import('@nestjs/testing');
    const { AppModule } = await import('../src/app.module');
    const { setupApp } = await import('../src/setup-app');
    const { loadConfig } = await import('../src/config/configuration');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    setupApp(app, loadConfig());
    await app.init();

    const org = await request(app.getHttpServer())
      .post('/v1/organizations')
      .set('x-admin-token', 'e2e-admin-token')
      .send({ name: `E2E ${Date.now()}` })
      .expect(201);
    apiKey = org.body.apiKey;
  });

  afterAll(async () => {
    await app?.close();
    await new Promise((r) => receiver?.close(r));
  });

  const api = () => {
    const server = app.getHttpServer();
    const auth = { Authorization: `Bearer ${apiKey}` };
    return {
      get: (path: string) => request(server).get(path).set(auth),
      post: (path: string, body?: object) => request(server).post(path).set(auth).send(body),
    };
  };

  it('rejects requests without a valid API key', async () => {
    await request(app.getHttpServer()).get('/v1/applications').expect(401);
    await request(app.getHttpServer())
      .get('/v1/applications')
      .set('Authorization', 'Bearer hf_live_nope')
      .expect(401);
  });

  it('delivers a signed webhook only to subscribed endpoints', async () => {
    await api().post('/v1/applications', { name: 'Shop', uid: 'shop' }).expect(201);
    const ok = await api()
      .post('/v1/endpoints', { applicationId: 'shop', url: `${receiverUrl}/ok`, filterTypes: ['order.created'] })
      .expect(201);
    await api()
      .post('/v1/endpoints', { applicationId: 'shop', url: `${receiverUrl}/refunds`, filterTypes: ['refund.created'] })
      .expect(201);

    const msg = await api()
      .post('/v1/applications/shop/messages', { eventType: 'order.created', payload: { orderId: 'o1' } })
      .expect(202);
    expect(msg.body.deliveries).toHaveLength(1);

    const hit = await waitFor(async () => received.find((r) => r.headers['webhook-id'] === msg.body.id));
    expect(hit.path).toBe('/ok');

    const { verifySignature } = await import('../src/common/signature');
    expect(
      verifySignature(
        ok.body.secret,
        String(hit.headers['webhook-id']),
        Number(hit.headers['webhook-timestamp']),
        hit.body,
        String(hit.headers['webhook-signature']),
      ),
    ).toBe(true);
    expect(JSON.parse(hit.body)).toMatchObject({ type: 'order.created', data: { orderId: 'o1' } });

    const delivery = await waitFor(async () => {
      const res = await api().get(`/v1/deliveries?messageId=${msg.body.id}`);
      return res.body.data[0]?.status === 'SUCCEEDED' ? res.body.data[0] : undefined;
    });
    expect(delivery.attemptCount).toBe(1);
  });

  it('retries, dead-letters after the last attempt, and replays on request', async () => {
    await api().post('/v1/applications', { name: 'Crm', uid: 'crm' }).expect(201);
    await api().post('/v1/endpoints', { applicationId: 'crm', url: `${receiverUrl}/down` }).expect(201);
    const msg = await api()
      .post('/v1/applications/crm/messages', { eventType: 'user.registered', payload: { id: 1 } })
      .expect(202);

    const failed = await waitFor(async () => {
      const res = await api().get(`/v1/deliveries?messageId=${msg.body.id}&status=FAILED`);
      return res.body.data[0];
    });
    expect(failed.attemptCount).toBe(3);

    const detail = await api().get(`/v1/deliveries/${failed.id}`).expect(200);
    expect(detail.body.attempts.map((a: { statusCode: number }) => a.statusCode)).toEqual([500, 500, 500]);

    await api().post(`/v1/deliveries/${failed.id}/replay`).expect(201);
    const replayed = await waitFor(async () => {
      const res = await api().get(`/v1/deliveries/${failed.id}`);
      return res.body.attemptCount === 4 && res.body.status === 'FAILED' ? res.body : undefined;
    });
    expect(replayed.attempts).toHaveLength(4);
  });

  it('returns the original message for a repeated idempotency key', async () => {
    const first = await api()
      .post('/v1/applications/shop/messages', { eventType: 'order.created', payload: { n: 1 } })
      .set('Idempotency-Key', 'order-42')
      .expect(202);
    const again = await api()
      .post('/v1/applications/shop/messages', { eventType: 'order.created', payload: { n: 2 } })
      .set('Idempotency-Key', 'order-42')
      .expect(200);
    expect(again.headers['idempotent-replayed']).toBe('true');
    expect(again.body.id).toBe(first.body.id);
  });

  it('reports stats for the organization', async () => {
    const stats = await api().get('/v1/stats').expect(200);
    expect(stats.body).toMatchObject({ applications: 2, activeEndpoints: 3 });
    expect(stats.body.succeeded).toBeGreaterThanOrEqual(1);
    const daily = await api().get('/v1/stats/daily?days=7').expect(200);
    expect(daily.body).toHaveLength(7);
  });
});
