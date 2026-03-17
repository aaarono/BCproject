import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @MaxLength(100)
  email!: string;

  @ApiProperty({ example: 'strong_password', minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password!: string;
}
