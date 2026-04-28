import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateProfileBadgesDto {
  @ApiProperty({
    example: ['FIRST_SALE', 'TRUSTED_SELLER'],
    required: false,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(64, { each: true })
  codes?: string[];
}
