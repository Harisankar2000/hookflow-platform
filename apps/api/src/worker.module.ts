import { Module } from '@nestjs/common';
import { CoreModule } from './core.module';
import { DeliveryWorkerModule } from './delivery-worker/delivery-worker.module';
import { AppLoggerModule } from './logger.module';

/** Delivery worker only: no HTTP server. Scale it separately from the API. */
@Module({ imports: [AppLoggerModule, CoreModule, DeliveryWorkerModule] })
export class WorkerModule {}
