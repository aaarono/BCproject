import { IsString, MinLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  conversationId!: string;

  @IsString()
  @MinLength(1)
  text!: string;
}
