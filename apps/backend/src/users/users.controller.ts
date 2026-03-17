import { Body, Controller, Get, Patch, UseGuards, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { UsersService } from './users.service';
import { UpdateMeDto } from './dto/update-me.dto';

@ApiTags('Users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @ApiOperation({ summary: 'Get my full profile' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me/profile')
  getMyProfile(@CurrentUser() user: JwtPayload) {
    return this.usersService.getMyProfile(user.sub);
  }

  @ApiOperation({ summary: 'Update my display name or email' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch('me')
  updateMe(@CurrentUser() user: JwtPayload, @Body() dto: UpdateMeDto) {
    return this.usersService.updateMe(user.sub, dto);
  }

  @ApiOperation({ summary: 'Get top sellers leaderboard' })
  @Get('top-sellers')
  getTopSellers() {
    return this.usersService.getTopSellers();
  }

  @ApiOperation({ summary: 'Get weekly top sellers leaderboard' })
  @Get('top-sellers/weekly')
  getWeeklyTopSellers() {
    return this.usersService.getWeeklyTopSellers();
  }

  @ApiOperation({ summary: 'Get public profile of a user' })
  @Get(':id')
  getPublicProfile(@Param('id') id: string) {
    return this.usersService.getPublicProfile(id);
  }
}
