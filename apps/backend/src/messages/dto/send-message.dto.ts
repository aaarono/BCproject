import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendMessageDto {
  @ApiProperty({ example: 'clxyz123abc' })
  @IsString()
  @IsNotEmpty()
  conversationId!: string;

  @ApiProperty({ example: 'Hello, is this still available?' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(5000)
  text!: string;
}
