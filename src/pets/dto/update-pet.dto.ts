import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdatePetDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  especie?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  raza?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  edad?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  ownerId?: number;
}