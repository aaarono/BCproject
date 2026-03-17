import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TopUpDto {
  @ApiProperty({ example: 10000, description: 'Amount in cents' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount: number;
}