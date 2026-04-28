import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export const BAN_DURATION_VALUES = ['1day', '3days', '7days', '30days', 'PERMANENT'] as const;
export type BanDuration = (typeof BAN_DURATION_VALUES)[number];

export class BanUserDto {
  @ApiProperty({ enum: BAN_DURATION_VALUES })
  @IsIn(BAN_DURATION_VALUES)
  duration: BanDuration;

  @ApiProperty({ maxLength: 500 })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}
