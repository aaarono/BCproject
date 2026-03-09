import { IsEnum, IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ListingType } from '@prisma/client';

export enum ListingTypeDto {
  GOOD = 'GOOD',
  SERVICE = 'SERVICE',
}

export class CreateListingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  price: number;

  @IsEnum(ListingType)
  type: ListingType;
}
