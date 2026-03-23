import {
  Body,
  Controller,
  Delete,
  Get,
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
import { DealStatus, ListingStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from './admin.guard';
import { AdminService } from './admin.service';
import { ListAdminQueryDto } from './dto/list-admin-query.dto';
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
  @Get('deals')
  listDeals(
    @Query() query: ListAdminQueryDto,
    @Query('status') status?: DealStatus,
  ) {
    return this.adminService.listDeals(query, status);
  }

  @ApiOperation({ summary: 'List reviews for moderation' })
  @Get('reviews')
  listReviews(@Query() query: ListAdminQueryDto) {
    return this.adminService.listReviews(query);
  }

  @ApiOperation({ summary: 'Delete review as admin' })
  @Delete('reviews/:id')
  deleteReview(@Param('id') id: string) {
    return this.adminService.deleteReview(id);
  }
}
