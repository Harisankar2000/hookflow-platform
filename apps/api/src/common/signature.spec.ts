import { signPayload, verifySignature } from './signature';

describe('webhook signatures', () => {
  const secret = 'whsec_' + Buffer.from('a-test-signing-key').toString('base64');
  const body = '{"type":"payment.succeeded","data":{"amount":499}}';
  const ts = 1_760_000_000;

  it('produces a v1 signature that verifies', () => {
    const header = signPayload(secret, 'msg_1', ts, body);
    expect(header).toMatch(/^v1,[A-Za-z0-9+/]+=*$/);
    expect(verifySignature(secret, 'msg_1', ts, body, header, 300, ts)).toBe(true);
  });

  it('rejects a tampered body, another message id or another secret', () => {
    const header = signPayload(secret, 'msg_1', ts, body);
    expect(verifySignature(secret, 'msg_1', ts, body + ' ', header, 300, ts)).toBe(false);
    expect(verifySignature(secret, 'msg_2', ts, body, header, 300, ts)).toBe(false);
    const other = 'whsec_' + Buffer.from('another-key').toString('base64');
    expect(verifySignature(other, 'msg_1', ts, body, header, 300, ts)).toBe(false);
  });

  it('rejects timestamps outside the tolerance window', () => {
    const header = signPayload(secret, 'msg_1', ts, body);
    expect(verifySignature(secret, 'msg_1', ts, body, header, 300, ts + 301)).toBe(false);
  });
});
