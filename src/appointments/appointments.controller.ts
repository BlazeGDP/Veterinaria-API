import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';

import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { Appointment } from './appointment.entity';

@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly appointmentsService: AppointmentsService) {}

  @Post()
  create(
    @Body() createAppointmentDto: CreateAppointmentDto,
  ): Promise<Appointment> {
    return this.appointmentsService.create(createAppointmentDto);
  }

  @Get()
  findAll(@Query('fecha') fecha?: string): Promise<Appointment[]> {
    return this.appointmentsService.findAll(fecha);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<Appointment> {
    return this.appointmentsService.findOne(id.toString());
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAppointmentDto: UpdateAppointmentDto,
  ): Promise<Appointment> {
    return this.appointmentsService.update(
      id.toString(),
      updateAppointmentDto,
    );
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.appointmentsService.remove(id.toString());
  }
}
