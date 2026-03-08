import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { DealsService } from './deals.service';

@UseGuards(JwtAuthGuard)
@Controller('deals')
export class DealsController {
  constructor(private readonly deals: DealsService) {}

  // Create deal by listingId
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() body: { listingId: string }) {
    return this.deals.create(body.listingId, user.sub);
  }

  @Get('me')
  myDeals(@CurrentUser() user: JwtPayload) {
    return this.deals.getMyDeals(user.sub);
  }

  @Get('active/by-listing/:listingId/by-buyer/:buyerId')
  getActiveByListingAndBuyer(
    @Param('listingId') listingId: string,
    @Param('buyerId') buyerId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.deals.getActiveByListingAndBuyer(listingId, buyerId, user.sub);
  }

  @Get(':id')
  getById(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.deals.getById(id, user.sub);
  }

  @Post(':id/fund')
  fund(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.deals.fund(id, user.sub);
  }

  @Post(':id/delivered')
  delivered(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.deals.markDelivered(id, user.sub);
  }

  @Post(':id/complete')
  complete(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.deals.complete(id, user.sub);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.deals.cancel(id, user.sub);
  }
}
