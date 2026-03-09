import { IsEmail, IsOptional, IsString, Max, MaxLength, MinLength } from 'class-validator';

export class UpdateMeDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  displayName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(100)
  email?: string;
}