import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class UpdateAchievementDto {
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
