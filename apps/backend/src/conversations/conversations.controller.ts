import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { ConversationsService } from './conversations.service';

@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  @Post()
  createOrGet(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateConversationDto,
  ) {
    return this.service.createOrGet(dto.listingId, user.sub);
  }

  @Get('me')
  getMyConversations(@CurrentUser() user: JwtPayload) {
    return this.service.getMyConversations(user.sub);
  }

  @Get(':id')
  getById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.getById(id, user.sub);
  }

  @Get(':id/messages')
  getMessages(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.getMessages(id, user.sub);
  }

  @Get('by-listing/:listingId/by-buyer/:buyerId')
  getByListingAndBuyer(
    @CurrentUser() user: JwtPayload,
    @Param('listingId') listingId: string,
    @Param('buyerId') buyerId: string,
  ) {
    return this.service.getByListingAndBuyer(listingId, buyerId, user.sub);
  }
}
