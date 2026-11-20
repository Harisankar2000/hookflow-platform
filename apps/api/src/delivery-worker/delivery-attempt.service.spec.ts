import { DeliveryStatus } from '@prisma/client';
import { AppConfig } from '../config/configuration';
import { DeliveryAttemptService } from './delivery-attempt.service';
import { SendResult } from './webhook-sender';

function setup(delivery: Record<string, unknown> | null, result: Partial<SendResult> = {}) {
  const updates: Record<string, unknown>[] = [];
  const prisma = {
    delivery: {
      findUnique: jest.fn().mockResolvedValue(delivery),
      update: jest.fn((args: { data: Record<string, unknown> }) => {
        updates.push(args.data);
        return args;
      }),
    },
    deliveryAttempt: { create: jest.fn((args: unknown) => args) },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const sender = {
    send: jest.fn().mockResolvedValue({
      ok: false,
      statusCode: 500,
      durationMs: 12,
      responseBody: null,
      error: 'HTTP 500',
      ...result,
    }),
  };
  const queue = { enqueue: jest.fn() };
  const live = { publish: jest.fn() };
  const config = { retryScheduleMs: [1000, 2000] } as AppConfig;
  const service = new DeliveryAttemptService(
    prisma as never,
    sender as never,
    queue as never,
    live as never,
    config,
  );
  return { service, prisma, sender, queue, live, updates };
}

const baseDelivery = (overrides: Record<string, unknown> = {}) => ({
  id: 'd1',
  messageId: 'm1',
  endpointId: 'e1',
  status: DeliveryStatus.PENDING,
  attemptCount: 0,
  endpoint: { url: 'http://x/hook', secret: 'whsec_abc', disabled: false },
  message: {
    eventType: 'order.created',
    payload: { a: 1 },
    createdAt: new Date(),
    application: { organizationId: 'org1' },
  },
  ...overrides,
});

describe('DeliveryAttemptService', () => {
  it('marks a 2xx response as succeeded and schedules nothing', async () => {
    const { service, queue, updates, live } = setup(baseDelivery(), { ok: true, statusCode: 200, error: null });
    await expect(service.run({ deliveryId: 'd1', attempt: 1 })).resolves.toBe('succeeded');
    expect(updates[0]).toMatchObject({ status: 'SUCCEEDED', attemptCount: 1, nextAttemptAt: null });
    expect(queue.enqueue).not.toHaveBeenCalled();
    expect(live.publish).toHaveBeenCalledWith(expect.objectContaining({ organizationId: 'org1' }));
  });

  it('schedules the next attempt after a failure while retries remain', async () => {
    const { service, queue, updates } = setup(baseDelivery());
    await expect(service.run({ deliveryId: 'd1', attempt: 1 })).resolves.toBe('retrying');
    expect(updates[0]).toMatchObject({ status: 'RETRYING', attemptCount: 1 });
    expect(queue.enqueue).toHaveBeenCalledWith('d1', 2, expect.any(Number));
  });

  it('dead-letters the delivery on the last attempt', async () => {
    const { service, queue, updates } = setup(baseDelivery({ attemptCount: 2, status: 'RETRYING' }));
    await expect(service.run({ deliveryId: 'd1', attempt: 3 })).resolves.toBe('failed');
    expect(updates[0]).toMatchObject({ status: 'FAILED', attemptCount: 3 });
    expect(queue.enqueue).not.toHaveBeenCalled();
  });

  it('skips stale or duplicate jobs without calling the endpoint', async () => {
    const { service, sender } = setup(baseDelivery({ attemptCount: 1 }));
    await expect(service.run({ deliveryId: 'd1', attempt: 1 })).resolves.toBe('skipped');
    expect(sender.send).not.toHaveBeenCalled();
  });

  it('does not call a disabled endpoint and fails without retrying', async () => {
    const { service, sender, queue, updates } = setup(
      baseDelivery({ endpoint: { url: 'http://x', secret: 's', disabled: true } }),
    );
    await expect(service.run({ deliveryId: 'd1', attempt: 1 })).resolves.toBe('failed');
    expect(sender.send).not.toHaveBeenCalled();
    expect(queue.enqueue).not.toHaveBeenCalled();
    expect(updates[0]).toMatchObject({ lastError: 'Endpoint is disabled' });
  });
});
