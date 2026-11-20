import { Inject, Injectable, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_PUB } from '../redis.tokens';
import { LIVE_CHANNEL, LiveEvent } from './live-events';

/**
 * Publishes dashboard updates on Redis pub/sub, so a worker running in its own
 * process can still reach browsers connected to any API instance.
 */
@Injectable()
export class LiveEventsPublisher {
  private readonly logger = new Logger(LiveEventsPublisher.name);

  constructor(@Inject(REDIS_PUB) private readonly redis: Redis) {}

  publish(event: LiveEvent): void {
    this.redis.publish(LIVE_CHANNEL, JSON.stringify(event)).catch((err: Error) => {
      // Live updates are best effort; the delivery log in Postgres is the source of truth.
      this.logger.warn(`Live event not published: ${err.message}`);
    });
  }
}
