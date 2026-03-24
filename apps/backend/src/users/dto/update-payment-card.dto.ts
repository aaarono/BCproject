import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class UpdatePaymentCardDto {
  @ApiProperty({
    example: '4242 4242 4242 4242',
    description: 'Payment card number used only for masked linking',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(12)
  @MaxLength(25)
  cardNumber: string;
}
