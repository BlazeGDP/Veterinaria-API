import {
  Controller,
  Get,
  Headers,
  Header,
  NotFoundException,
  Param,
  UnauthorizedException,
} from '@nestjs/common';

import { renderPrometheusMetrics } from './metrics';

@Controller('metrics')
export class MetricsController {
  @Get(':track')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  getMetrics(
    @Param('track') pathTrack: string,
    @Headers('authorization') authorization: string | undefined,
  ): string {
    const requestedTrack = process.env.APP_TRACK || 'local';
    const expectedToken = process.env.METRICS_BEARER_TOKEN;

    if (!expectedToken || authorization !== `Bearer ${expectedToken}`) {
      throw new UnauthorizedException('Invalid metrics token');
    }

    if (!['stable', 'canary'].includes(requestedTrack) || pathTrack !== requestedTrack) {
      throw new NotFoundException('Metrics track not found');
    }

    return renderPrometheusMetrics();
  }
}
