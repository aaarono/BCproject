import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDealDto {
  @ApiProperty({ example: 'clxyz123abc' })
  @IsString()
  @IsNotEmpty()
  listingId: string;

  @ApiProperty({ example: 1, minimum: 1, maximum: 1000, required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity?: number;
}
