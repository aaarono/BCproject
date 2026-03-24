import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WithdrawDto {
  @ApiProperty({ example: 5000, description: 'Amount in cents (gross amount)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount: number;
}
