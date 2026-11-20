import { IsBoolean, IsNotEmpty, IsObject, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export const EVENT_TYPE_PATTERN = /^[a-z0-9_]+(\.[a-z0-9_]+)*$/;

export class CreateEventTypeDto {
  /** Dotted lowercase name, e.g. "payment.succeeded". */
  @Matches(EVENT_TYPE_PATTERN, { message: 'name must look like "payment.succeeded"' })
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /** Example payload shown to developers in the dashboard. */
  @IsOptional()
  @IsObject()
  schemaExample?: Record<string, unknown>;
}

export class UpdateEventTypeDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsObject()
  schemaExample?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
