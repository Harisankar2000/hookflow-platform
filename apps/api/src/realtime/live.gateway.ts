import { Inject, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import Redis from 'ioredis';
import { Server, Socket } from 'socket.io';
import { ApiKeyService } from '../auth/api-key.service';
import { loadConfig } from '../config/configuration';
import { REDIS_PUB } from '../redis.tokens';
import { LIVE_CHANNEL, LiveEvent } from './live-events';

/**
 * Pushes delivery updates to the dashboard. Browsers authenticate with their API key
 * and join a room per organization; events arrive from any process over Redis pub/sub.
 */
@WebSocketGateway({ namespace: '/live', cors: { origin: loadConfig().corsOrigin } })
export class LiveGateway implements OnGatewayConnection, OnModuleInit, OnModuleDestroy {
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(LiveGateway.name);
  private subscriber?: Redis;

  constructor(
    private readonly apiKeys: ApiKeyService,
    @Inject(REDIS_PUB) private readonly redis: Redis,
  ) {}

  async onModuleInit() {
    this.subscriber = this.redis.duplicate();
    await this.subscriber.subscribe(LIVE_CHANNEL);
    this.subscriber.on('message', (_channel, raw) => {
      try {
        const event = JSON.parse(raw) as LiveEvent;
        this.server.to(`org:${event.organizationId}`).emit(event.type, event.data);
      } catch (err) {
        this.logger.warn(`Bad live event: ${(err as Error).message}`);
      }
    });
  }

  async onModuleDestroy() {
    await this.subscriber?.quit();
  }

  async handleConnection(client: Socket) {
    const apiKey = (client.handshake.auth as { apiKey?: string } | undefined)?.apiKey;
    const identity = apiKey ? await this.apiKeys.authenticate(apiKey) : null;
    if (!identity) {
      client.emit('error', { message: 'Unauthorized' });
      client.disconnect(true);
      return;
    }
    await client.join(`org:${identity.organizationId}`);
  }
}
