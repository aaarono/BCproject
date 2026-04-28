import { Controller, Get, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { SystemNotificationsService } from './system-notifications.service';
import { ListSystemNotificationsDto } from './dto/list-system-notifications.dto';

@ApiTags('SystemNotifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('system-notifications')
export class SystemNotificationsController {
  constructor(private readonly service: SystemNotificationsService) {}

  @ApiOperation({ summary: 'List my system notifications as chat messages' })
  @Get('me')
  getMyNotifications(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListSystemNotificationsDto,
  ) {
    return this.service.getMyNotifications(user.sub, query.limit);
  }

  @ApiOperation({ summary: 'Mark all my system notifications as read' })
  @Patch('me/read')
  markMyNotificationsAsRead(@CurrentUser() user: JwtPayload) {
    return this.service.markAllAsRead(user.sub);
  }
}
