import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { OrgId } from '../auth/org-id.decorator';
import { CreateApplicationDto, UpdateApplicationDto } from './applications.dto';
import { ApplicationsService } from './applications.service';

@ApiTags('Applications')
@ApiBearerAuth()
@UseGuards(ApiKeyGuard)
@Controller('v1/applications')
export class ApplicationsController {
  constructor(private readonly applications: ApplicationsService) {}

  @Get()
  list(@OrgId() orgId: string) {
    return this.applications.list(orgId);
  }

  @Post()
  create(@OrgId() orgId: string, @Body() dto: CreateApplicationDto) {
    return this.applications.create(orgId, dto);
  }

  @Get(':app')
  get(@OrgId() orgId: string, @Param('app') app: string) {
    return this.applications.resolve(orgId, app);
  }

  @Patch(':app')
  update(@OrgId() orgId: string, @Param('app') app: string, @Body() dto: UpdateApplicationDto) {
    return this.applications.update(orgId, app, dto);
  }

  @Delete(':app')
  remove(@OrgId() orgId: string, @Param('app') app: string) {
    return this.applications.remove(orgId, app);
  }
}
