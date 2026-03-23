import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class AssignAchievementDto {
  @ApiProperty({ example: 'FAST_RESPONDER' })
  @IsString()
  @Length(2, 50)
  achievementCode!: string;
}
