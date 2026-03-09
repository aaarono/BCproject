import { IsNotEmpty, IsString } from 'class-validator';

export class CreateDealDto {
  @IsString()
  @IsNotEmpty()
  listingId: string;
}