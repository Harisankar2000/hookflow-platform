import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { AuthedRequest } from '../auth/auth.types';
import { OrgId } from '../auth/org-id.decorator';
import { generateApiKey } from '../common/crypto';
import { PrismaService } from '../prisma/prisma.service';

class CreateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;
}

const publicFields = { id: true, name: true, prefix: true, lastUsedAt: true, revokedAt: true, createdAt: true };

@ApiTags('API keys')
@ApiBearerAuth()
@UseGuards(ApiKeyGuard)
@Controller('v1/api-keys')
export class ApiKeysController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.prisma.apiKey.findMany({
      where: { organizationId: orgId },
      select: publicFields,
      orderBy: { createdAt: 'desc' },
    });
  }

  /** The full key is returned once. Store it somewhere safe. */
  @Post()
  async create(@OrgId() orgId: string, @Body() dto: CreateApiKeyDto) {
    const { key, prefix, hash } = generateApiKey();
    const created = await this.prisma.apiKey.create({
      data: { organizationId: orgId, name: dto.name, prefix, hash },
      select: publicFields,
    });
    return { ...created, key };
  }

  @Delete(':id')
  async revoke(@OrgId() orgId: string, @Param('id') id: string, @Req() req: AuthedRequest) {
    if (id === req.apiKeyId) throw new BadRequestException('You cannot revoke the key you are using');
    const result = await this.prisma.apiKey.updateMany({
      where: { id, organizationId: orgId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count === 0) throw new NotFoundException('API key not found');
    return { revoked: true };
  }
}
