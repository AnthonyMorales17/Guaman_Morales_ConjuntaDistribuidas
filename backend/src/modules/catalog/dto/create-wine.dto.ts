import { IsString, IsNumber, IsOptional, IsInt, Min } from 'class-validator';

export class CreateWineDto {
  @IsString()
  name!: string;

  @IsString()
  type!: string;

  @IsString()
  wineryName!: string;

  @IsString()
  origin!: string;

  @IsString()
  grape!: string;

  @IsNumber()
  @Min(0)
  referencePrice!: number;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsInt()
  vintage?: number;

  @IsOptional()
  @IsString()
  tastingNote?: string;

  @IsOptional()
  @IsString()
  pairing?: string;

  @IsOptional()
  @IsString()
  denominationOfOrigin?: string;

  @IsOptional()
  @IsString()
  aging?: string;

  @IsOptional()
  @IsInt()
  criticScore?: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}
