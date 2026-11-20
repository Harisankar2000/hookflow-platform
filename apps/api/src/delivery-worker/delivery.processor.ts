import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { loadConfig } from '../config/configuration';
import { DELIVERY_QUEUE, DeliverJobData } from './delivery.constants';
import { DeliveryAttemptService } from './delivery-attempt.service';

@Processor(DELIVERY_QUEUE, { concurrency: loadConfig().deliveryConcurrency })
export class DeliveryProcessor extends WorkerHost {
  constructor(private readonly attempts: DeliveryAttemptService) {
    super();
  }

  async process(job: Job<DeliverJobData>) {
    return this.attempts.run(job.data);
  }
}
