import { IsEnum, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';
import { ListingTypeDto } from './create-listing.dto';

export class UpdateListingDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  title?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsEnum(ListingTypeDto)
  type?: ListingTypeDto;
}
