import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Appointment } from './appointment.entity';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

@Injectable()
export class AppointmentsService {
  constructor(
    @InjectRepository(Appointment)
    private readonly appointmentsRepository: Repository<Appointment>,
  ) {}

  async create(
    createAppointmentDto: CreateAppointmentDto,
  ): Promise<Appointment> {
    const appointment = this.appointmentsRepository.create({
      fecha: new Date(createAppointmentDto.fecha),
      motivo: createAppointmentDto.motivo,
      estado: createAppointmentDto.estado,
      petId: createAppointmentDto.petId.toString(),
    });

    return this.appointmentsRepository.save(appointment);
  }

  async findAll(fecha?: string): Promise<Appointment[]> {
  if (!fecha) {
    return this.appointmentsRepository.find({
      relations: ['pet'],
    });
  }

  const inicio = new Date(`${fecha}T00:00:00`);
  const fin = new Date(`${fecha}T00:00:00`);

  fin.setDate(fin.getDate() + 1);

  return this.appointmentsRepository
    .createQueryBuilder('appointment')
    .leftJoinAndSelect('appointment.pet', 'pet')
    .where('appointment.fecha >= :inicio', { inicio })
    .andWhere('appointment.fecha < :fin', { fin })
    .getMany();
}

  async findOne(id: string): Promise<Appointment> {
    const appointment = await this.appointmentsRepository.findOne({
      where: { id },
      relations: ['pet'],
    });

    if (!appointment) {
      throw new NotFoundException(
        `Cita con ID ${id} no encontrada`,
      );
    }

    return appointment;
  }

  async update(
    id: string,
    updateAppointmentDto: UpdateAppointmentDto,
  ): Promise<Appointment> {
    const appointment = await this.findOne(id);

    appointment.fecha =
      updateAppointmentDto.fecha !== undefined
        ? new Date(updateAppointmentDto.fecha)
        : appointment.fecha;

    appointment.motivo =
      updateAppointmentDto.motivo ?? appointment.motivo;

    appointment.estado =
      updateAppointmentDto.estado ?? appointment.estado;

    if (updateAppointmentDto.petId !== undefined) {
      appointment.petId =
        updateAppointmentDto.petId.toString();
    }

    return this.appointmentsRepository.save(appointment);
  }

  async remove(id: string): Promise<void> {
    const appointment = await this.findOne(id);

    await this.appointmentsRepository.remove(appointment);
  }
}