import { IsOptional, IsString } from 'class-validator';

export class UpdateActiveBadgeDto {
  @IsOptional()
  @IsString()
  code?: string;
}
