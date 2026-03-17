import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ListingCategory, ListingType } from '@prisma/client';

export enum ListingTypeDto {
  GOOD = 'GOOD',
  SERVICE = 'SERVICE',
}

export class CreateListingDto {
  @ApiProperty({ example: 'Vintage Watch' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @ApiProperty({ example: 'A beautiful vintage watch from the 1960s' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description: string;

  @ApiProperty({ example: 4999, description: 'Price in cents' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  price: number;

  @ApiProperty({ enum: ListingType, example: 'GOOD' })
  @IsEnum(ListingType)
  type: ListingType;

  @ApiProperty({ enum: ListingCategory, example: 'GAMES' })
  @IsEnum(ListingCategory)
  category: ListingCategory;

  @ApiProperty({
    required: false,
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

  @ApiProperty({
    required: false,
    example: 20,
    description: 'Sale discount percent (1..90)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(90)
  salePercent?: number;

  @ApiProperty({
    required: false,
    example: '2026-03-17T10:00:00.000Z',
    description: 'Sale start datetime (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  saleStartsAt?: string;

  @ApiProperty({
    required: false,
    example: '2026-03-24T10:00:00.000Z',
    description: 'Sale end datetime (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  saleEndsAt?: string;
}
