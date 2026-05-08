import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

class SendMessageMediaItemDto {
  @ApiProperty({
    example: 'http://localhost:3000/uploads/messages/example.jpg',
  })
  @IsString()
  @IsUrl({ require_tld: false })
  mediaUrl!: string;

  @ApiProperty({ enum: ['IMAGE', 'VIDEO'] })
  @IsString()
  @IsIn(['IMAGE', 'VIDEO'])
  mediaType!: 'IMAGE' | 'VIDEO';
}

export class SendMessageDto {
  @ApiProperty({ example: 'clxyz123abc' })
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @ApiPropertyOptional({ example: 'Hello, is this still available?' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  text?: string;

  @ApiPropertyOptional({
    example: 'http://localhost:3000/uploads/messages/example.jpg',
  })
  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false })
  mediaUrl?: string;

  @ApiPropertyOptional({ enum: ['IMAGE', 'VIDEO'] })
  @IsOptional()
  @IsString()
  @IsIn(['IMAGE', 'VIDEO'])
  mediaType?: 'IMAGE' | 'VIDEO';

  @ApiPropertyOptional({
    type: [SendMessageMediaItemDto],
    description: 'Up to 8 media items grouped in one message',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @ValidateNested({ each: true })
  @Type(() => SendMessageMediaItemDto)
  @IsObject({ each: true })
  mediaItems?: SendMessageMediaItemDto[];
}
