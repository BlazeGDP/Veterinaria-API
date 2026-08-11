import { IsDateString, IsEnum, IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { AppointmentStatus } from '../appointment.entity';

export class CreateAppointmentDto {
  @IsDateString()
  fecha!: string;

  @IsString()
  @IsNotEmpty()
  motivo!: string;

  @IsEnum(AppointmentStatus)
  @IsOptional()
  estado?: AppointmentStatus;

  @IsString()
  @IsNotEmpty()
  petId!: string;
}