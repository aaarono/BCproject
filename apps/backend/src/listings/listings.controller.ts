import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';

@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  getFeed() {
    return this.listings.getFeed();
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMyListings(@CurrentUser() user: JwtPayload) {
    return this.listings.getMyListings(user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/archive')
  archive(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.listings.archive(id, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id/restore')
  restore(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.listings.restore(id, user.sub);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.listings.getById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateListingDto) {
    return this.listings.create(user.sub, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateListingDto,
  ) {
    return this.listings.update(id, user.sub, dto);
  }
}
