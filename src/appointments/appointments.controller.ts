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
  OnModuleInit,
  Req,
} from '@nestjs/common';

import { HttpAdapterHost } from '@nestjs/core';
import { FastifyRequest } from 'fastify';

import { AppointmentsService } from './appointments.service';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

type TraceRequest = FastifyRequest & {
  traceId: string;
};

@Controller('appointments')
export class AppointmentsController implements OnModuleInit {
  constructor(
    private readonly appointmentsService: AppointmentsService,
    private readonly httpAdapterHost: HttpAdapterHost,
  ) {}

  onModuleInit() {
    const fastify =
      this.httpAdapterHost.httpAdapter.getInstance();

    fastify.route({
      method: 'QUERY',
      url: '/appointments',
      handler: async (
        request: TraceRequest & {
          body?: {
            fecha?: string;
          };
        },
      ) => {
        return this.appointmentsService.findAll(
          request.body?.fecha,
          request.traceId,
        );
      },
    });
  }

  @Post()
  create(
    @Body() createAppointmentDto: CreateAppointmentDto,
  ) {
    return this.appointmentsService.create(
      createAppointmentDto,
    );
  }

  @Get()
  findAll(
    @Query('fecha') fecha: string | undefined,
    @Req() request: TraceRequest,
  ) {
    return this.appointmentsService.findAll(
      fecha,
      request.traceId,
    );
  }

  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: TraceRequest,
  ) {
    return this.appointmentsService.findOne(
      id.toString(),
      request.traceId,
    );
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateAppointmentDto: UpdateAppointmentDto,
  ) {
    return this.appointmentsService.update(
      id.toString(),
      updateAppointmentDto,
    );
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.appointmentsService.remove(
      id.toString(),
    );
  }
}
