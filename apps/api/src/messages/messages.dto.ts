import { IsNotEmpty, IsObject, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PageQuery } from '../common/pagination';
import { EVENT_TYPE_PATTERN } from '../event-types/event-types.dto';

export class CreateMessageDto {
  @Matches(EVENT_TYPE_PATTERN, { message: 'eventType must look like "payment.succeeded"' })
  @MaxLength(100)
  eventType: string;

  @IsObject()
  payload: Record<string, unknown>;

  /** Same key = same message. Can also be sent as the Idempotency-Key header. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  idempotencyKey?: string;
}

export class ListMessagesQuery extends PageQuery {
  @IsOptional()
  @IsString()
  applicationId?: string;

  @IsOptional()
  @IsString()
  eventType?: string;
}
