import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { ListingType } from '@prisma/client';

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
}
