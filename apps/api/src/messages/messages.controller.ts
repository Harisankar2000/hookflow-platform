import {
  Body,
  Controller,
  Get,
  Headers,
  HttpStatus,
  Param,
  PayloadTooLargeException,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { OrgId } from '../auth/org-id.decorator';
import { CreateMessageDto, ListMessagesQuery } from './messages.dto';
import { MessagesService, PayloadTooLargeError } from './messages.service';

@ApiTags('Messages')
@ApiBearerAuth()
@UseGuards(ApiKeyGuard)
@Controller('v1')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  /** Publish an event. Returns 202 for a new message and 200 for an idempotent repeat. */
  @Post('applications/:app/messages')
  @ApiHeader({ name: 'Idempotency-Key', required: false })
  async publish(
    @OrgId() orgId: string,
    @Param('app') app: string,
    @Body() dto: CreateMessageDto,
    @Headers('idempotency-key') idempotencyHeader: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.messages.publish(orgId, app, {
        ...dto,
        idempotencyKey: dto.idempotencyKey ?? idempotencyHeader,
      });
      res.status(result.duplicate ? HttpStatus.OK : HttpStatus.ACCEPTED);
      if (result.duplicate) res.setHeader('Idempotent-Replayed', 'true');
      return result.message;
    } catch (err) {
      if (err instanceof PayloadTooLargeError) throw new PayloadTooLargeException(err.message);
      throw err;
    }
  }

  @Get('messages')
  list(@OrgId() orgId: string, @Query() query: ListMessagesQuery) {
    return this.messages.list(orgId, query);
  }

  @Get('messages/:id')
  get(@OrgId() orgId: string, @Param('id') id: string) {
    return this.messages.get(orgId, id);
  }
}
