import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { OrgId } from '../auth/org-id.decorator';
import { StatsService } from './stats.service';

@ApiTags('Stats')
@ApiBearerAuth()
@UseGuards(ApiKeyGuard)
@Controller('v1/stats')
export class StatsController {
  constructor(private readonly stats: StatsService) {}

  @Get()
  overview(@OrgId() orgId: string) {
    return this.stats.overview(orgId);
  }

  @Get('daily')
  daily(@OrgId() orgId: string, @Query('days', new DefaultValuePipe(7), ParseIntPipe) days: number) {
    return this.stats.daily(orgId, Math.min(Math.max(days, 1), 90));
  }
}
