import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { OrgId } from '../auth/org-id.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventTypeDto, UpdateEventTypeDto } from './event-types.dto';

@ApiTags('Event types')
@ApiBearerAuth()
@UseGuards(ApiKeyGuard)
@Controller('v1/event-types')
export class EventTypesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.prisma.eventType.findMany({
      where: { organizationId: orgId },
      orderBy: [{ archived: 'asc' }, { name: 'asc' }],
    });
  }

  @Post()
  async create(@OrgId() orgId: string, @Body() dto: CreateEventTypeDto) {
    try {
      return await this.prisma.eventType.create({
        data: {
          organizationId: orgId,
          name: dto.name,
          description: dto.description,
          schemaExample: dto.schemaExample as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`Event type "${dto.name}" already exists`);
      }
      throw err;
    }
  }

  @Patch(':id')
  async update(@OrgId() orgId: string, @Param('id') id: string, @Body() dto: UpdateEventTypeDto) {
    await this.find(orgId, id);
    return this.prisma.eventType.update({
      where: { id },
      data: {
        description: dto.description,
        archived: dto.archived,
        schemaExample: dto.schemaExample as Prisma.InputJsonValue | undefined,
      },
    });
  }

  @Delete(':id')
  async remove(@OrgId() orgId: string, @Param('id') id: string) {
    await this.find(orgId, id);
    await this.prisma.eventType.delete({ where: { id } });
    return { deleted: true };
  }

  private async find(orgId: string, id: string) {
    const eventType = await this.prisma.eventType.findFirst({ where: { id, organizationId: orgId } });
    if (!eventType) throw new NotFoundException('Event type not found');
    return eventType;
  }
}
