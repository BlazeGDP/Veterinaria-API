import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Post,
  Req,
} from '@nestjs/common';

import { Request } from 'express';

import { MetricsService } from '../metrics/metrics.service';
import { OrchestratorService } from './orchestrator.service';

type TraceRequest = Request & {
  traceId: string;
};

@Controller('orchestrator')
export class OrchestratorController {
  constructor(
    private readonly orchestrator: OrchestratorService,
    private readonly metrics: MetricsService,
  ) {}

  @Get('owners')
  async getOwners(
    @Req() request: TraceRequest,
  ) {
    return this.orchestrator.getOwners(
      request.traceId,
    );
  }

  @Get('owners/:id')
  async getOwnerById(
    @Param('id') id: string,
    @Req() request: TraceRequest,
  ) {
    return this.orchestrator.getOwnerById(
      id,
      request.traceId,
    );
  }

  @Get('pets')
  async getPets(
    @Req() request: TraceRequest,
  ) {
    return this.orchestrator.getPets(
      request.traceId,
    );
  }

  @Get('pets/:id')
  async getPetById(
    @Param('id') id: string,
    @Req() request: TraceRequest,
  ) {
    return this.orchestrator.getPetById(
      id,
      request.traceId,
    );
  }

  @Get('appointments')
  async getAppointments(
    @Req() request: TraceRequest,
  ) {
    return this.orchestrator.getAppointments(
      request.traceId,
    );
  }

  @Get('appointments/:id')
  async getAppointmentById(
    @Param('id') id: string,
    @Req() request: TraceRequest,
  ) {
    return this.orchestrator.getAppointmentById(
      id,
      request.traceId,
    );
  }

  @Post('queue')
  async sendMessage(
    @Body()
    body: {
      type: string;
      payload: Record<string, unknown>;
    },
    @Req() request: TraceRequest,
  ) {
    return this.orchestrator.sendMessage(
      body.type,
      body.payload,
      request.traceId,
    );
  }

  @Get('health')
  getHealth() {
    return {
      status: 'ok',
    };
  }

  @Get('metrics')
  @Header(
    'Content-Type',
    'text/plain; version=0.0.4',
  )
  async getMetrics() {
    return this.metrics.getMetrics();
  }

  @Get('metrics/aws')
  @Header(
    'Content-Type',
    'text/plain; version=0.0.4',
  )
  async getAwsMetrics(
    @Req() request: TraceRequest,
  ) {
    return this.orchestrator.getAwsMetrics(
      request.traceId,
    );
  }

  @Get('metrics/gcp')
  @Header(
    'Content-Type',
    'text/plain; version=0.0.4',
  )
  async getGcpMetrics(
    @Req() request: TraceRequest,
  ) {
    return this.orchestrator.getGcpMetrics(
      request.traceId,
    );
  }

  @Get('metrics/azure')
  @Header(
    'Content-Type',
    'text/plain; version=0.0.4',
  )
  async getAzureMetrics(
    @Req() request: TraceRequest,
  ) {
    return this.orchestrator.getAzureMetrics(
      request.traceId,
    );
  }
}
