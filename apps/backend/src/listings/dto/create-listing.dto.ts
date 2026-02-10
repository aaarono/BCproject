import { IsEnum, IsInt, IsString, Min, MinLength } from 'class-validator';

export enum ListingTypeDto {
  GOOD = 'GOOD',
  SERVICE = 'SERVICE',
}

export class CreateListingDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  @MinLength(10)
  description!: string;

  @IsInt()
  @Min(0)
  price!: number; // cents

  @IsEnum(ListingTypeDto)
  type!: ListingTypeDto;
}
