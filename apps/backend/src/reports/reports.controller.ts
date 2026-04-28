import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt.strategy';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportsService } from './reports.service';

@ApiTags('Reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @ApiOperation({ summary: 'Create a moderation report' })
  @Post()
  createReport(@CurrentUser() user: JwtPayload, @Body() dto: CreateReportDto) {
    return this.reportsService.createReport(user.sub, dto);
  }

  @ApiOperation({ summary: 'List my reports' })
  @Get('me')
  listMyReports(@CurrentUser() user: JwtPayload) {
    return this.reportsService.listMyReports(user.sub);
  }
}
