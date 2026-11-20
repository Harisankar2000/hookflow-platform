import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateApplicationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  /** Your own stable identifier, e.g. "payments". Usable in place of the id in URLs. */
  @IsOptional()
  @Matches(/^[a-z0-9][a-z0-9_-]{1,62}$/, {
    message: 'uid must be 2-63 lowercase letters, digits, "-" or "_"',
  })
  uid?: string;
}

export class UpdateApplicationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;
}
