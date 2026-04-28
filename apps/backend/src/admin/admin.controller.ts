import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Param,
  Patch,
  Query,
  Req,
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
import type { Request } from 'express';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { AssignAchievementDto } from './dto/assign-achievement.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { BroadcastSystemMessageDto } from './dto/broadcast-system-message.dto';
import { CreateAchievementDto } from './dto/create-achievement.dto';
import { ListAdminQueryDto } from './dto/list-admin-query.dto';
import { ModerateReportDto } from './dto/moderate-report.dto';
import { UpdateAchievementDto } from './dto/update-achievement.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { WarnUserDto } from './dto/warn-user.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  private getRequestId(req: Request) {
    const requestWithId = req as Request & { requestId?: string };
    return requestWithId.requestId;
  }

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
  updateUserRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() admin: JwtPayload,
    @Req() req: Request,
  ) {
    return this.adminService.updateUserRole(
      id,
      dto.role,
      admin.sub,
      this.getRequestId(req),
    );
  }

  @ApiOperation({ summary: 'Ban user' })
  @Post('users/:id/ban')
  banUser(
    @Param('id') id: string,
    @Body() dto: BanUserDto,
    @CurrentUser() admin: JwtPayload,
    @Req() req: Request,
  ) {
    return this.adminService.banUser(id, dto, admin.sub, this.getRequestId(req));
  }

  @ApiOperation({ summary: 'Unban user' })
  @Post('users/:id/unban')
  unbanUser(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
    @Req() req: Request,
  ) {
    return this.adminService.unbanUser(id, admin.sub, this.getRequestId(req));
  }

  @ApiOperation({ summary: 'Warn user' })
  @Post('users/:id/warn')
  warnUser(
    @Param('id') id: string,
    @Body() dto: WarnUserDto,
    @CurrentUser() admin: JwtPayload,
    @Req() req: Request,
  ) {
    return this.adminService.warnUser(id, dto, admin.sub, this.getRequestId(req));
  }

  @ApiOperation({ summary: 'Remove one active warning for user' })
  @Post('users/:id/unwarn')
  unwarnUser(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
    @Req() req: Request,
  ) {
    return this.adminService.unwarnUser(id, admin.sub, this.getRequestId(req));
  }

  @ApiOperation({ summary: 'Remove user avatar' })
  @Post('users/:id/remove-avatar')
  removeUserAvatar(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
    @Req() req: Request,
  ) {
    return this.adminService.removeUserAvatar(id, admin.sub, this.getRequestId(req));
  }

  @ApiOperation({ summary: 'Assign achievement to a user' })
  @Post('users/:id/achievements')
  assignAchievementToUser(
    @Param('id') id: string,
    @Body() dto: AssignAchievementDto,
    @CurrentUser() admin: JwtPayload,
    @Req() req: Request,
  ) {
    return this.adminService.assignAchievementToUser(
      id,
      dto.achievementCode,
      admin.sub,
      this.getRequestId(req),
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
  archiveListing(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
    @Req() req: Request,
  ) {
    return this.adminService.archiveListing(id, admin.sub, this.getRequestId(req));
  }

  @ApiOperation({ summary: 'Restore listing as admin' })
  @Patch('listings/:id/restore')
  restoreListing(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
    @Req() req: Request,
  ) {
    return this.adminService.restoreListing(id, admin.sub, this.getRequestId(req));
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

  @ApiOperation({ summary: 'List centralized admin audit logs' })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'entityType', required: false, type: String })
  @Get('audit-logs')
  listAuditLogs(
    @Query() query: ListAdminQueryDto,
    @Query('action') action?: string,
    @Query('entityType') entityType?: string,
  ) {
    return this.adminService.listAuditLogs(query, action, entityType);
  }

  @ApiOperation({ summary: 'Moderate report status and note' })
  @Get('reports/:id/case')
  getReportCase(@Param('id') id: string) {
    return this.adminService.getReportCase(id);
  }

  @ApiOperation({ summary: 'Moderate report status and note' })
  @Patch('reports/:id')
  moderateReport(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
    @Body() dto: ModerateReportDto,
    @Req() req: Request,
  ) {
    return this.adminService.moderateReport(
      id,
      admin.sub,
      dto,
      this.getRequestId(req),
    );
  }

  @ApiOperation({ summary: 'List achievements for admin panel' })
  @Get('achievements')
  listAchievements(@Query() query: ListAdminQueryDto) {
    return this.adminService.listAchievements(query);
  }

  @ApiOperation({ summary: 'Create achievement definition' })
  @Post('achievements')
  createAchievement(
    @Body() dto: CreateAchievementDto,
    @CurrentUser() admin: JwtPayload,
    @Req() req: Request,
  ) {
    return this.adminService.createAchievement(
      dto,
      admin.sub,
      this.getRequestId(req),
    );
  }

  @ApiOperation({ summary: 'Update achievement definition' })
  @Patch('achievements/:id')
  updateAchievement(
    @Param('id') id: string,
    @Body() dto: UpdateAchievementDto,
    @CurrentUser() admin: JwtPayload,
    @Req() req: Request,
  ) {
    return this.adminService.updateAchievement(
      id,
      dto,
      admin.sub,
      this.getRequestId(req),
    );
  }

  @ApiOperation({ summary: 'Delete achievement definition' })
  @Delete('achievements/:id')
  deleteAchievement(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
    @Req() req: Request,
  ) {
    return this.adminService.deleteAchievement(id, admin.sub, this.getRequestId(req));
  }

  @ApiOperation({ summary: 'List manual achievement assignment history' })
  @Get('achievements/assignments')
  listAchievementAssignments(@Query() query: ListAdminQueryDto) {
    return this.adminService.listAchievementAssignments(query);
  }

  @ApiOperation({ summary: 'Finalize previous week top seller reward' })
  @Post('weekly-rewards/finalize-previous-week')
  finalizePreviousWeekTopSellerReward(
    @CurrentUser() admin: JwtPayload,
    @Req() req: Request,
  ) {
    return this.adminService.finalizePreviousWeekTopSellerReward(
      admin.sub,
      this.getRequestId(req),
    );
  }

  @ApiOperation({ summary: 'Broadcast system message to all users' })
  @Post('system-notifications/broadcast')
  broadcastSystemMessage(
    @CurrentUser() admin: JwtPayload,
    @Body() dto: BroadcastSystemMessageDto,
    @Req() req: Request,
  ) {
    return this.adminService.broadcastSystemMessage(
      admin.sub,
      dto,
      this.getRequestId(req),
    );
  }

  @ApiOperation({ summary: 'Delete review as admin' })
  @Delete('reviews/:id')
  deleteReview(
    @Param('id') id: string,
    @CurrentUser() admin: JwtPayload,
    @Req() req: Request,
  ) {
    return this.adminService.deleteReview(id, admin.sub, this.getRequestId(req));
  }
}
