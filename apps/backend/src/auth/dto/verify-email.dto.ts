import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ example: 'token-from-email-link' })
  @IsString()
  @MinLength(20)
  @MaxLength(256)
  token!: string;
}
