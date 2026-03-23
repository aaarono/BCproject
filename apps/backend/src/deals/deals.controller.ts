import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { DealsService } from './deals.service';
import { CreateDealDto } from './dto/create-deal.dto';

@ApiTags('Deals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('deals')
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  @ApiOperation({ summary: 'Create and fund a deal' })
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateDealDto) {
    return this.deals.create(dto.listingId, user.sub, dto.quantity);
  }

  @ApiOperation({ summary: 'Get all my deals' })
  @Get('me')
  myDeals(@CurrentUser() user: JwtPayload) {
    return this.deals.getMyDeals(user.sub);
  }

  @ApiOperation({ summary: 'Find active deal by listing and buyer' })
  @Get('active/by-listing/:listingId/by-buyer/:buyerId')
  getActiveByListingAndBuyer(
    @Param('listingId') listingId: string,
    @Param('buyerId') buyerId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.deals.getActiveByListingAndBuyer(listingId, buyerId, user.sub);
  }

  @ApiOperation({ summary: 'Get deal by ID' })
  @Get(':id')
  getById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.deals.getById(id, user.sub);
  }

  @ApiOperation({ summary: 'Fund an initiated deal' })
  @Post(':id/fund')
  fund(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.deals.fund(id, user.sub);
  }

  @ApiOperation({ summary: 'Mark deal as delivered (seller)' })
  @Post(':id/delivered')
  delivered(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.deals.markDelivered(id, user.sub);
  }

  @ApiOperation({ summary: 'Complete deal and release escrow (buyer)' })
  @Post(':id/complete')
  complete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.deals.complete(id, user.sub);
  }

  @ApiOperation({ summary: 'Cancel deal and refund if funded (seller)' })
  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.deals.cancel(id, user.sub);
  }
}
