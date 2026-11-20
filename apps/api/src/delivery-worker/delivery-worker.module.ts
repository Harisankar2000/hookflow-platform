import { Module } from '@nestjs/common';
import { DeliveryAttemptService } from './delivery-attempt.service';
import { DeliveryProcessor } from './delivery.processor';
import { StuckDeliverySweeper } from './stuck-delivery.sweeper';
import { WebhookSender } from './webhook-sender';

/** The consumer side. Loaded by worker.ts, and by the API when RUN_WORKER_IN_API=true. */
@Module({
  providers: [WebhookSender, DeliveryAttemptService, DeliveryProcessor, StuckDeliverySweeper],
})
export class DeliveryWorkerModule {}
