import {
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePetDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  especie!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  raza!: string;

  @IsInt()
  @Min(0)
  edad!: number;

  @IsInt()
  @IsPositive()
  ownerId!: number;
}