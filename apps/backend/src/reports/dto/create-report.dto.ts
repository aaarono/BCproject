import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportTargetType } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateReportDto {
  @ApiProperty({ enum: ReportTargetType })
  @IsEnum(ReportTargetType)
  targetType: ReportTargetType;

  @ApiProperty({ example: 'cm123exampletargetid' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  targetId: string;

  @ApiProperty({ example: 'Possible scam listing with misleading data' })
  @IsString()
  @MinLength(8)
  @MaxLength(300)
  reason: string;

  @ApiPropertyOptional({ example: 'Seller asks to continue outside platform and changed terms in chat.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  details?: string;
}
