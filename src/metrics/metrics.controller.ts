import { Controller, Get, Res } from '@nestjs/common';
import { FastifyReply } from 'fastify';

import { MetricsService } from './metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  async getMetrics(@Res() response: FastifyReply) {
    response.header(
      'Content-Type',
      'text/plain; version=0.0.4',
    );

    response.send(await this.metrics.getMetrics());
  }
}