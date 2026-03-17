import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateConversationDto {
  @ApiProperty({ example: 'clxyz123abc' })
  @IsString()
  @IsNotEmpty()
  listingId!: string;
}
