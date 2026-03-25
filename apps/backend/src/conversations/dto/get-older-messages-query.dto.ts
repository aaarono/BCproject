import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class GetOlderMessagesQueryDto {
  @ApiPropertyOptional({
    description: 'ISO date cursor to fetch messages older than this timestamp',
    example: '2026-03-25T21:31:42.692Z',
  })
  @IsDateString()
  beforeCreatedAt!: string;

  @ApiPropertyOptional({
    description: 'Message id cursor to disambiguate equal timestamps',
    example: 'cmn6k6msk0007le3uyl3o8o05',
  })
  @IsString()
  beforeId!: string;

  @ApiPropertyOptional({ example: 50, default: 50, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
