import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { OrgId } from '../auth/org-id.decorator';
import { ListDeliveriesQuery, ReplayFailedDto } from './deliveries.dto';
import { DeliveriesService } from './deliveries.service';

@ApiTags('Deliveries')
@ApiBearerAuth()
@UseGuards(ApiKeyGuard)
@Controller('v1/deliveries')
export class DeliveriesController {
  constructor(private readonly deliveries: DeliveriesService) {}

  @Get()
  list(@OrgId() orgId: string, @Query() query: ListDeliveriesQuery) {
    return this.deliveries.list(orgId, query);
  }

  @Post('replay-failed')
  replayFailed(@OrgId() orgId: string, @Body() dto: ReplayFailedDto) {
    return this.deliveries.replayFailed(orgId, dto);
  }

  @Get(':id')
  get(@OrgId() orgId: string, @Param('id') id: string) {
    return this.deliveries.get(orgId, id);
  }

  @Post(':id/replay')
  replay(@OrgId() orgId: string, @Param('id') id: string) {
    return this.deliveries.replay(orgId, id);
  }
}
