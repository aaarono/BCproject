import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import {
  DealCancellationActor,
  DealStatus,
  ListingStatus,
  ReportStatus,
  ReportTargetType,
} from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { JwtPayload } from '../auth/jwt.strategy';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { AssignAchievementDto } from './dto/assign-achievement.dto';
import { BroadcastSystemMessageDto } from './dto/broadcast-system-message.dto';
import { CreateAchievementDto } from './dto/create-achievement.dto';
import { ListAdminQueryDto } from './dto/list-admin-query.dto';
import { ModerateReportDto } from './dto/moderate-report.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @ApiOperation({ summary: 'Get admin overview metrics' })
  @Get('overview')
  getOverview() {
    return this.adminService.getOverview();
  }

  @ApiOperation({ summary: 'List users for admin panel' })
  @Get('users')
  listUsers(@Query() query: ListAdminQueryDto) {
    return this.adminService.listUsers(query);
  }

  @ApiOperation({ summary: 'Update user role' })
  @Patch('users/:id/role')
  updateUserRole(@Param('id') id: string, @Body() dto: UpdateUserRoleDto) {
    return this.adminService.updateUserRole(id, dto.role);
  }

  @ApiOperation({ summary: 'Assign achievement to a user' })
  @Post('users/:id/achievements')
  assignAchievementToUser(
    @Param('id') id: string,
    @Body() dto: AssignAchievementDto,
    @CurrentUser() admin: JwtPayload,
  ) {
    return this.adminService.assignAchievementToUser(
      id,
      dto.achievementCode,
      admin.sub,
    );
  }

  @ApiOperation({ summary: 'List listings for moderation' })
  @ApiQuery({ name: 'status', required: false, enum: ListingStatus })
  @Get('listings')
  listListings(
    @Query() query: ListAdminQueryDto,
    @Query('status') status?: ListingStatus,
  ) {
    return this.adminService.listListings(query, status);
  }

  @ApiOperation({ summary: 'Archive listing as admin' })
  @Patch('listings/:id/archive')
  archiveListing(@Param('id') id: string) {
    return this.adminService.archiveListing(id);
  }

  @ApiOperation({ summary: 'Restore listing as admin' })
  @Patch('listings/:id/restore')
  restoreListing(@Param('id') id: string) {
    return this.adminService.restoreListing(id);
  }

  @ApiOperation({ summary: 'List deals for admin panel' })
  @ApiQuery({ name: 'status', required: false, enum: DealStatus })
  @ApiQuery({
    name: 'canceledByActor',
    required: false,
    enum: DealCancellationActor,
  })
  @Get('deals')
  listDeals(
    @Query() query: ListAdminQueryDto,
    @Query('status') status?: DealStatus,
    @Query('canceledByActor') canceledByActor?: DealCancellationActor,
  ) {
    return this.adminService.listDeals(query, status, canceledByActor);
  }

  @ApiOperation({ summary: 'List reviews for moderation' })
  @Get('reviews')
  listReviews(@Query() query: ListAdminQueryDto) {
    return this.adminService.listReviews(query);
  }

  @ApiOperation({ summary: 'List user reports for moderation' })
  @ApiQuery({ name: 'status', required: false, enum: ReportStatus })
  @ApiQuery({ name: 'targetType', required: false, enum: ReportTargetType })
  @Get('reports')
  listReports(
    @Query() query: ListAdminQueryDto,
    @Query('status') status?: ReportStatus,
    @Query('targetType') targetType?: ReportTargetType,
  ) {
    return this.adminService.listReports(query, status, targetType);
  }

  @ApiOperation({ summary: 'Moderate report status and note' })
  @Patch('reports/:id')
  moderateReport(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
    @Body() dto: ModerateReportDto,
  ) {
    return this.adminService.moderateReport(id, admin.sub, dto);
  }

  @ApiOperation({ summary: 'List achievements for admin panel' })
  @Get('achievements')
  listAchievements(@Query() query: ListAdminQueryDto) {
    return this.adminService.listAchievements(query);
  }

  @ApiOperation({ summary: 'Create achievement definition' })
  @Post('achievements')
  createAchievement(@Body() dto: CreateAchievementDto) {
    return this.adminService.createAchievement(dto);
  }

  @ApiOperation({ summary: 'List manual achievement assignment history' })
  @Get('achievements/assignments')
  listAchievementAssignments(@Query() query: ListAdminQueryDto) {
    return this.adminService.listAchievementAssignments(query);
  }

  @ApiOperation({ summary: 'Finalize previous week top seller reward' })
  @Post('weekly-rewards/finalize-previous-week')
  finalizePreviousWeekTopSellerReward() {
    return this.adminService.finalizePreviousWeekTopSellerReward();
  }

  @ApiOperation({ summary: 'Broadcast system message to all users' })
  @Post('system-notifications/broadcast')
  broadcastSystemMessage(
    @CurrentUser() admin: JwtPayload,
    @Body() dto: BroadcastSystemMessageDto,
  ) {
    return this.adminService.broadcastSystemMessage(admin.sub, dto);
  }

  @ApiOperation({ summary: 'Delete review as admin' })
  @Delete('reviews/:id')
  deleteReview(@Param('id') id: string) {
    return this.adminService.deleteReview(id);
  }
}
