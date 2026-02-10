import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export enum RoleDto {
  BUYER = 'BUYER',
  SELLER = 'SELLER',
}

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsString()
  displayName!: string;

  @IsOptional()
  @IsEnum(RoleDto)
  role?: RoleDto;
}
