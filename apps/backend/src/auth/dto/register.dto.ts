import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export enum RoleDto {
  BUYER = 'BUYER',
  SELLER = 'SELLER',
}

export class RegisterDto {
  @IsEmail()
  @MaxLength(100)
  email!: string;

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(50)
  displayName!: string;

  @IsOptional()
  @IsEnum(RoleDto)
  role?: RoleDto;
}
