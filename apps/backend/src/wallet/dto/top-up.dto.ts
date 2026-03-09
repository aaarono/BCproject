import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class TopUpDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amount: number;
}