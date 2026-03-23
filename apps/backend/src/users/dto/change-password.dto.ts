import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'current_password' })
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  currentPassword: string;

  @ApiProperty({ example: 'new_strong_password' })
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  newPassword: string;
}
