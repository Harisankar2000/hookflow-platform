import { BullModule } from '@nestjs/bullmq';
import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import Redis from 'ioredis';
import { AdminGuard } from './auth/admin.guard';
import { ApiKeyGuard } from './auth/api-key.guard';
import { ApiKeyService } from './auth/api-key.service';
import { APP_CONFIG, AppConfig, loadConfig } from './config/configuration';
import { DELIVERY_QUEUE } from './delivery-worker/delivery.constants';
import { DeliveryQueueService } from './delivery-worker/delivery-queue.service';
import { PrismaService } from './prisma/prisma.service';
import { LiveEventsPublisher } from './realtime/live-events.publisher';
import { REDIS_PUB } from './redis.tokens';

const config = loadConfig();

/** Shared infrastructure used by both the API process and the worker process. */
@Global()
@Module({
  imports: [
    BullModule.forRoot({ connection: { url: config.redisUrl } }),
    BullModule.registerQueue({ name: DELIVERY_QUEUE }),
  ],
  providers: [
    { provide: APP_CONFIG, useValue: config },
    {
      provide: REDIS_PUB,
      useFactory: (cfg: AppConfig) => new Redis(cfg.redisUrl, { maxRetriesPerRequest: 2 }),
      inject: [APP_CONFIG],
    },
    PrismaService,
    ApiKeyService,
    ApiKeyGuard,
    AdminGuard,
    DeliveryQueueService,
    LiveEventsPublisher,
  ],
  exports: [
    APP_CONFIG,
    REDIS_PUB,
    BullModule,
    PrismaService,
    ApiKeyService,
    ApiKeyGuard,
    AdminGuard,
    DeliveryQueueService,
    LiveEventsPublisher,
  ],
})
export class CoreModule implements OnApplicationShutdown {
  constructor(@Inject(REDIS_PUB) private readonly redis: Redis) {}

  async onApplicationShutdown() {
    await this.redis.quit();
  }
}
