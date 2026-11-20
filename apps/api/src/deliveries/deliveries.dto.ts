import { DeliveryStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PageQuery } from '../common/pagination';

export class ListDeliveriesQuery extends PageQuery {
  @IsOptional()
  @IsEnum(DeliveryStatus)
  status?: DeliveryStatus;

  @IsOptional()
  @IsString()
  endpointId?: string;

  @IsOptional()
  @IsString()
  applicationId?: string;

  @IsOptional()
  @IsString()
  messageId?: string;

  @IsOptional()
  @IsString()
  eventType?: string;
}

export class ReplayFailedDto {
  /** Limit the replay to one endpoint. */
  @IsOptional()
  @IsString()
  endpointId?: string;

  /** Limit the replay to one application (id or uid). */
  @IsOptional()
  @IsString()
  applicationId?: string;
}
