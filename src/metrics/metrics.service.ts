import { Injectable } from '@nestjs/common';
import {
  Counter,
  Histogram,
  collectDefaultMetrics,
  register,
} from '@prometheus-io/client';

@Injectable()
export class MetricsService {
  readonly requestsTotal = new Counter({
    name: 'veterinaria_requests_total',
    help: 'Total de solicitudes recibidas por la API veterinaria',
    labelNames: ['method', 'route', 'status'],
  });

  readonly requestDuration = new Histogram({
    name: 'veterinaria_request_duration_seconds',
    help: 'Duración de las solicitudes de la API veterinaria',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  });

  constructor() {
    collectDefaultMetrics();
  }

  async getMetrics(): Promise<string> {
    return register.metrics();
  }
}