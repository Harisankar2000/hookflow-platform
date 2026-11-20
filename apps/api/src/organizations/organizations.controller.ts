import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { OrgId } from '../auth/org-id.decorator';
import { generateApiKey } from '../common/crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto, UpdateOrganizationDto } from './organizations.dto';

@ApiTags('Organization')
@Controller('v1')
export class OrganizationsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Create an organization and its first API key. The key is shown only once. */
  @Post('organizations')
  @UseGuards(AdminGuard)
  @ApiHeader({ name: 'x-admin-token', required: true })
  async create(@Body() dto: CreateOrganizationDto) {
    const { key, prefix, hash } = generateApiKey();
    const organization = await this.prisma.organization.create({
      data: { name: dto.name, apiKeys: { create: { name: 'Default key', prefix, hash } } },
    });
    return { organization, apiKey: key };
  }

  @Get('organization')
  @UseGuards(ApiKeyGuard)
  @ApiBearerAuth()
  me(@OrgId() orgId: string) {
    return this.prisma.organization.findUniqueOrThrow({ where: { id: orgId } });
  }

  @Patch('organization')
  @UseGuards(ApiKeyGuard)
  @ApiBearerAuth()
  update(@OrgId() orgId: string, @Body() dto: UpdateOrganizationDto) {
    return this.prisma.organization.update({ where: { id: orgId }, data: { name: dto.name } });
  }
}
