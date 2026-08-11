import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Appointment } from './appointment.entity';
import { Pet } from '../pets/pet.entity';

import { AppointmentsService } from './appointments.service';
import { AppointmentsController } from './appointments.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Appointment,
      Pet,
    ]),
  ],

  controllers: [
    AppointmentsController,
  ],

  providers: [
    AppointmentsService,
  ],

  exports: [
    AppointmentsService,
  ],
})
export class AppointmentsModule {}