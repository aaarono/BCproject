import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDealDto {
  @ApiProperty({ example: 'clxyz123abc' })
  @IsString()
  @IsNotEmpty()
  listingId: string;
}