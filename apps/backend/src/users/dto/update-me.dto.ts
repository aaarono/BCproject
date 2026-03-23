import {
  IsEmail,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class UpdateMeDto {
  @ApiPropertyOptional({ example: 'New Name' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  displayName?: string;

  @ApiPropertyOptional({ example: 'new@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.png' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  })
  @IsUrl({ require_protocol: true })
  @MaxLength(500)
  avatarUrl?: string | null;
}
