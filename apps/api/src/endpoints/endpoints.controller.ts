import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { OrgId } from '../auth/org-id.decorator';
import { MessagesService } from '../messages/messages.service';
import { CreateEndpointDto, ListEndpointsQuery, UpdateEndpointDto } from './endpoints.dto';
import { EndpointsService } from './endpoints.service';

@ApiTags('Endpoints')
@ApiBearerAuth()
@UseGuards(ApiKeyGuard)
@Controller('v1/endpoints')
export class EndpointsController {
  constructor(
    private readonly endpoints: EndpointsService,
    private readonly messages: MessagesService,
  ) {}

  @Get()
  list(@OrgId() orgId: string, @Query() query: ListEndpointsQuery) {
    return this.endpoints.list(orgId, query.applicationId);
  }

  /** Returns the signing secret once on creation. */
  @Post()
  create(@OrgId() orgId: string, @Body() dto: CreateEndpointDto) {
    return this.endpoints.create(orgId, dto);
  }

  @Get(':id')
  get(@OrgId() orgId: string, @Param('id') id: string) {
    return this.endpoints.find(orgId, id);
  }

  @Patch(':id')
  update(@OrgId() orgId: string, @Param('id') id: string, @Body() dto: UpdateEndpointDto) {
    return this.endpoints.update(orgId, id, dto);
  }

  @Delete(':id')
  remove(@OrgId() orgId: string, @Param('id') id: string) {
    return this.endpoints.remove(orgId, id);
  }

  @Get(':id/secret')
  secret(@OrgId() orgId: string, @Param('id') id: string) {
    return this.endpoints.getSecret(orgId, id);
  }

  @Post(':id/rotate-secret')
  rotate(@OrgId() orgId: string, @Param('id') id: string) {
    return this.endpoints.rotateSecret(orgId, id);
  }

  /** Sends a `hookflow.test` message to this endpoint only. */
  @Post(':id/test')
  test(@OrgId() orgId: string, @Param('id') id: string) {
    return this.messages.sendTest(orgId, id);
  }
}
