import { createServer } from 'node:http';
import { verifyWebhook } from './verify.mjs';

/**
 * A stand-in for your customers' servers, so you can watch HookFlow retry and dead-letter.
 *   /ok           always 200
 *   /slow         200 after SLOW_MS
 *   /flaky        fails FAIL_RATE of requests with 503
 *   /down         always 500
 *   /status/:code responds with that code
 * Set RECEIVER_SECRET to verify signatures; bad signatures get 401.
 */
const port = Number(process.env.PORT ?? 4200);
const failRate = Number(process.env.FAIL_RATE ?? 0.3);
const slowMs = Number(process.env.SLOW_MS ?? 1500);
const secret = process.env.RECEIVER_SECRET;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function decide(path) {
  if (path === '/ok') return 200;
  if (path === '/slow') return sleep(slowMs).then(() => 200);
  if (path === '/flaky') return Math.random() < failRate ? 503 : 200;
  if (path === '/down') return 500;
  const match = path.match(/^\/status\/(\d{3})$/);
  if (match) return Number(match[1]);
  return 404;
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') return res.end('ok');
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end();
  }
  const body = await readBody(req);
  if (secret && !verifyWebhook(secret, req.headers, body)) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ error: 'invalid signature' }));
  }
  const status = await decide(new URL(req.url, 'http://x').pathname);
  let type = '?';
  try {
    type = JSON.parse(body).type;
  } catch {}
  console.log(`${new Date().toISOString()} ${req.url} ${type} -> ${status}`);
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ received: status < 300, id: req.headers['webhook-id'] }));
});

server.listen(port, () => console.log(`Demo receiver on http://localhost:${port}`));
