import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { UpdateListingDto } from './dto/update-listing.dto';
import { ListingQueryDto } from './dto/listing-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/jwt.strategy';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import type { Request } from 'express';

const LISTING_IMAGE_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const ALLOWED_LISTING_IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

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

  @ApiOperation({ summary: 'Upload listing image' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('upload-image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: 'uploads/listings',
        filename: (_req, file, cb) => {
          const extension = extname(file.originalname || '').toLowerCase();
          const normalizedExtension = extension.length > 0 ? extension : '.jpg';
          cb(
            null,
            `${Date.now()}-${Math.round(Math.random() * 1e9)}${normalizedExtension}`,
          );
        },
      }),
      limits: { fileSize: LISTING_IMAGE_MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, cb) => {
        if (!ALLOWED_LISTING_IMAGE_MIME_TYPES.has(file.mimetype)) {
          cb(
            new BadRequestException('Unsupported listing image file type'),
            false,
          );
          return;
        }

        cb(null, true);
      },
    }),
  )
  uploadImage(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: Request,
  ) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    const protocol =
      (req.headers['x-forwarded-proto'] as string | undefined) ?? req.protocol;
    const host = req.get('host');

    if (!host) {
      throw new BadRequestException('Host header is required');
    }

    return {
      imageUrl: `${protocol}://${host}/uploads/listings/${file.filename}`,
    };
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

  @ApiOperation({ summary: 'Get listing price history' })
  @Get(':id/price-history')
  getPriceHistory(@Param('id') id: string, @Query('period') period?: string) {
    const normalizedPeriod = period === 'all' ? 'all' : '30d';
    return this.listings.getPriceHistory(id, normalizedPeriod);
  }

  @ApiOperation({ summary: 'Get listing discount policy/range' })
  @Get(':id/discount-policy')
  getDiscountPolicy(@Param('id') id: string) {
    return this.listings.getDiscountPolicy(id);
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
