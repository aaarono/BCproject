import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { CreateConversationDto } from './dto/create-conversation.dto';
import { GetOlderMessagesQueryDto } from './dto/get-older-messages-query.dto';
import { ConversationsService } from './conversations.service';

@ApiTags('Conversations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly service: ConversationsService) {}

  @ApiOperation({ summary: 'Create or get existing conversation' })
  @Post()
  createOrGet(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateConversationDto,
  ) {
    return this.service.createOrGet(dto.listingId, user.sub);
  }

  @ApiOperation({ summary: 'Get my conversations (inbox)' })
  @Get('me')
  getMyConversations(@CurrentUser() user: JwtPayload) {
    return this.service.getMyConversations(user.sub);
  }

  @ApiOperation({ summary: 'Get conversation by ID' })
  @Get(':id')
  getById(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.getById(id, user.sub);
  }

  @ApiOperation({ summary: 'Get messages in a conversation' })
  @Get(':id/messages')
  getMessages(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.getMessages(id, user.sub);
  }

  @ApiOperation({
    summary: 'Get older messages in a conversation (cursor-based)',
  })
  @Get(':id/messages/older')
  getOlderMessages(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Query() query: GetOlderMessagesQueryDto,
  ) {
    if (!query.beforeCreatedAt || !query.beforeId) {
      throw new BadRequestException(
        'beforeCreatedAt and beforeId are required',
      );
    }

    return this.service.getOlderMessages({
      conversationId: id,
      userId: user.sub,
      beforeCreatedAt: query.beforeCreatedAt,
      beforeId: query.beforeId,
      limit: query.limit,
    });
  }

  @ApiOperation({ summary: 'Find conversation by listing and buyer' })
  @Get('by-listing/:listingId/by-buyer/:buyerId')
  getByListingAndBuyer(
    @CurrentUser() user: JwtPayload,
    @Param('listingId') listingId: string,
    @Param('buyerId') buyerId: string,
  ) {
    return this.service.getByListingAndBuyer(listingId, buyerId, user.sub);
  }
}
