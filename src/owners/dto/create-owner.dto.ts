import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Length,
} from 'class-validator';

export class CreateOwnerDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  nombre!: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 100)
  apellido!: string;

  @IsString()
  @IsNotEmpty()
  @Length(7, 20)
  telefono!: string;

  @IsEmail()
  @IsNotEmpty()
  @Length(5, 255)
  email!: string;
}