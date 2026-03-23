import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length, Matches } from 'class-validator';

export class CreateAchievementDto {
  @ApiProperty({
    example: 'FAST_RESPONDER',
    description: 'Unique technical code for achievement',
  })
  @IsString()
  @Length(2, 50)
  @Matches(/^[A-Z0-9_]+$/, {
    message: 'code must contain only A-Z, 0-9 and underscore',
  })
  code!: string;

  @ApiProperty({ example: 'Fast Responder' })
  @IsString()
  @Length(2, 80)
  title!: string;

  @ApiProperty({
    example: 'Respond quickly to buyer conversations to build trust.',
  })
  @IsString()
  @Length(4, 280)
  description!: string;
}
