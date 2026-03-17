import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { ListingCategory, ListingType } from '@prisma/client';

export class UpdateListingDto {
  @ApiPropertyOptional({ example: 'Updated Title' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({ example: 'Updated description' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 5999, description: 'Price in cents' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  price?: number;

  @ApiPropertyOptional({ enum: ListingType })
  @IsOptional()
  @IsEnum(ListingType)
  type?: ListingType;

  @ApiPropertyOptional({ enum: ListingCategory })
  @IsOptional()
  @IsEnum(ListingCategory)
  category?: ListingCategory;

  @ApiPropertyOptional({
    type: [String],
    example: ['eu', 'alliance', 'sale'],
    description: 'Optional listing tags (max 8)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(24, { each: true })
  tags?: string[];

  @ApiPropertyOptional({
    example: 20,
    description: 'Sale discount percent (1..90)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  salePercent?: number;

  @ApiPropertyOptional({
    example: '2026-03-17T10:00:00.000Z',
    description: 'Sale start datetime (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  saleStartsAt?: string;

  @ApiPropertyOptional({
    example: '2026-03-24T10:00:00.000Z',
    description: 'Sale end datetime (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  saleEndsAt?: string;
}
