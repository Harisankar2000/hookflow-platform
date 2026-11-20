import { Injectable } from '@nestjs/common';
import { hashApiKey } from '../common/crypto';
import { PrismaService } from '../prisma/prisma.service';

const LAST_USED_WRITE_INTERVAL_MS = 60_000;

@Injectable()
export class ApiKeyService {
  constructor(private readonly prisma: PrismaService) {}

  /** Returns the key's organization, or null when the key is unknown or revoked. */
  async authenticate(rawKey: string): Promise<{ organizationId: string; apiKeyId: string } | null> {
    const key = await this.prisma.apiKey.findUnique({ where: { hash: hashApiKey(rawKey) } });
    if (!key || key.revokedAt) return null;

    // Avoid a write on every request: refresh lastUsedAt at most once a minute.
    if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > LAST_USED_WRITE_INTERVAL_MS) {
      void this.prisma.apiKey
        .update({ where: { id: key.id }, data: { lastUsedAt: new Date() } })
        .catch(() => undefined);
    }
    return { organizationId: key.organizationId, apiKeyId: key.id };
  }
}
