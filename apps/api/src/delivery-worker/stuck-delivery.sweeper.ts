import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DeliveryStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DeliveryQueueService } from './delivery-queue.service';

const SWEEP_EVERY_MS = 60_000;
const STUCK_AFTER_MS = 2 * 60_000;
const BATCH = 500;

/**
 * Safety net for the gap between the database commit and the Redis enqueue: any delivery
 * still waiting well past its due time is queued again. Job ids make this idempotent.
 */
@Injectable()
export class StuckDeliverySweeper implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(StuckDeliverySweeper.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: DeliveryQueueService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.sweep(), SWEEP_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy() {
    clearInterval(this.timer);
  }

  async sweep(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - STUCK_AFTER_MS);
    const stuck = await this.prisma.delivery.findMany({
      where: {
        status: { in: [DeliveryStatus.PENDING, DeliveryStatus.RETRYING] },
        updatedAt: { lt: cutoff },
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lt: cutoff } }],
      },
      select: { id: true, attemptCount: true },
      take: BATCH,
    });
    for (const d of stuck) await this.queue.enqueue(d.id, d.attemptCount + 1);
    if (stuck.length) this.logger.warn(`Re-queued ${stuck.length} stuck deliveries`);
    return stuck.length;
  }
}
