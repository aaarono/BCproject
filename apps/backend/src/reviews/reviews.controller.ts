import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { CreateReviewDto } from './dto/create-review.dto';
import { ReviewsService } from './reviews.service';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @ApiOperation({ summary: 'Create a review for a completed deal' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateReviewDto) {
    return this.reviews.create(user.sub, dto);
  }

  @ApiOperation({ summary: 'Get all reviews for a seller' })
  @Get('seller/:sellerId')
  getSeller(@Param('sellerId') sellerId: string) {
    return this.reviews.getSellerReviews(sellerId);
  }

  @ApiOperation({ summary: 'Get review for a specific deal' })
  @Get('deal/:dealId')
  getByDeal(@Param('dealId') dealId: string) {
    return this.reviews.getByDeal(dealId);
  }
}
