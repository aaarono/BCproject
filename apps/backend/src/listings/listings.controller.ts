import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingQueryDto } from './dto/listing-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';

@ApiTags('Listings')
@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @ApiOperation({ summary: 'Get public feed of active listings (paginated)' })
  @Get()
  getFeed(@Query() query: ListingQueryDto) {
    return this.listings.getFeed(query);
  }

  @ApiOperation({ summary: 'Get my listings (all statuses)' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMyListings(@CurrentUser() user: JwtPayload) {
    return this.listings.getMyListings(user.sub);
  }

  @ApiOperation({ summary: 'Archive a listing' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id/archive')
  archive(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.listings.archive(id, user.sub);
  }

  @ApiOperation({ summary: 'Restore an archived listing' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch(':id/restore')
  restore(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.listings.restore(id, user.sub);
  }

  @ApiOperation({ summary: 'Get a single listing by ID' })
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.listings.getById(id);
  }

  @ApiOperation({ summary: 'Create a new listing' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateListingDto) {
    return this.listings.create(user.sub, dto);
  }

  @ApiOperation({ summary: 'Update a listing' })
  @ApiBearerAuth()
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
