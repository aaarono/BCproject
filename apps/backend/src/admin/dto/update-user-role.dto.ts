import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const ADMIN_ROLE_VALUES = ['USER', 'ADMIN'] as const;
export type AdminRoleValue = (typeof ADMIN_ROLE_VALUES)[number];

export class UpdateUserRoleDto {
  @ApiProperty({ enum: ADMIN_ROLE_VALUES })
  @IsIn(ADMIN_ROLE_VALUES)
  role: AdminRoleValue;
}
