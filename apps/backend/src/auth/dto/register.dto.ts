import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum RoleDto {
  BUYER = 'BUYER',
  SELLER = 'SELLER',
}

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @MaxLength(100)
  email!: string;

  @ApiProperty({ example: 'strong_password', minLength: 6 })
  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password!: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  displayName!: string;

  @ApiPropertyOptional({ enum: RoleDto, default: RoleDto.BUYER })
  @IsOptional()
  @IsEnum(RoleDto)
  role?: RoleDto;
}
