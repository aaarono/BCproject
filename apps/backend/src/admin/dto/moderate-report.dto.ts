import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class ModerateReportDto {
  @ApiProperty({ enum: ReportStatus })
  @IsEnum(ReportStatus)
  status: ReportStatus;

  @ApiPropertyOptional({ example: 'Verified violation and listing archived.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNote?: string;
}
