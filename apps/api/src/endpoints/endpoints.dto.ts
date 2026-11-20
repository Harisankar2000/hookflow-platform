import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
} from 'class-validator';
import { EVENT_TYPE_PATTERN } from '../event-types/event-types.dto';

const URL_OPTIONS = { protocols: ['http', 'https'], require_tld: false, require_protocol: true };

export class CreateEndpointDto {
  /** Application id or uid. */
  @IsString()
  @IsNotEmpty()
  applicationId: string;

  @IsUrl(URL_OPTIONS)
  @MaxLength(2048)
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  /** Event types to receive. Leave empty to receive every event. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @Matches(EVENT_TYPE_PATTERN, { each: true })
  filterTypes?: string[];
}

export class UpdateEndpointDto {
  @IsOptional()
  @IsUrl(URL_OPTIONS)
  @MaxLength(2048)
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  description?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @Matches(EVENT_TYPE_PATTERN, { each: true })
  filterTypes?: string[];

  @IsOptional()
  @IsBoolean()
  disabled?: boolean;
}

export class ListEndpointsQuery {
  @IsOptional()
  @IsString()
  applicationId?: string;
}
