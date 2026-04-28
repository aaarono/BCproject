import { IsOptional, IsString, MaxLength } from 'class-validator';

export class BroadcastSystemMessageDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @IsString()
  @MaxLength(2000)
  text!: string;
}
