import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_PUB } from '../redis.tokens';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_PUB) private readonly redis: Redis,
  ) {}

  /** Readiness: both PostgreSQL and Redis answer. */
  @Get()
  async check() {
    const [db, redis] = await Promise.allSettled([
      this.prisma.$queryRaw`SELECT 1`,
      this.redis.ping(),
    ]);
    const status = {
      database: db.status === 'fulfilled' ? 'up' : 'down',
      redis: redis.status === 'fulfilled' ? 'up' : 'down',
    };
    if (status.database === 'down' || status.redis === 'down') {
      throw new ServiceUnavailableException(status);
    }
    return { status: 'ok', ...status };
  }
}
