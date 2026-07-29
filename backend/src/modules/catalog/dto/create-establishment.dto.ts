import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';

export class CreateEstablishmentDto {
  @IsString()
  name!: string;

  @IsString()
  type!: string;

  @IsNumber()
  lat!: number;

  @IsNumber()
  lng!: number;

  @IsString()
  address!: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  contactEmail?: string;
}
