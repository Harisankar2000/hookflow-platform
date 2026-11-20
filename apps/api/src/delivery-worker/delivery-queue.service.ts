import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { DELIVER_JOB, DELIVERY_QUEUE, DeliverJobData, deliverJobId } from './delivery.constants';

@Injectable()
export class DeliveryQueueService {
  constructor(@InjectQueue(DELIVERY_QUEUE) private readonly queue: Queue<DeliverJobData>) {}

  async enqueue(deliveryId: string, attempt: number, delayMs = 0): Promise<void> {
    await this.queue.add(
      DELIVER_JOB,
      { deliveryId, attempt },
      {
        jobId: deliverJobId(deliveryId, attempt),
        delay: delayMs,
        // Retries are scheduled by the worker itself so every attempt is logged.
        attempts: 1,
        removeOnComplete: { age: 3600, count: 5000 },
        removeOnFail: { age: 24 * 3600 },
      },
    );
  }

  async enqueueMany(deliveryIds: string[]): Promise<void> {
    if (deliveryIds.length === 0) return;
    await this.queue.addBulk(
      deliveryIds.map((deliveryId) => ({
        name: DELIVER_JOB,
        data: { deliveryId, attempt: 1 },
        opts: {
          jobId: deliverJobId(deliveryId, 1),
          attempts: 1,
          removeOnComplete: { age: 3600, count: 5000 },
          removeOnFail: { age: 24 * 3600 },
        },
      })),
    );
  }
}
