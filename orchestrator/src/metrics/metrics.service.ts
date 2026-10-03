import { Injectable } from '@nestjs/common';

import {
  Counter,
  Gauge,
  Histogram,
  collectDefaultMetrics,
  register,
} from '@prometheus-io/client';

@Injectable()
export class MetricsService {
  readonly requestsTotal = new Counter({
    name: 'orchestrator_requests_total',
    help: 'Total de solicitudes recibidas por el orquestador',
    labelNames: ['method', 'route', 'status'],
  });

  readonly requestDuration = new Histogram({
    name: 'orchestrator_request_duration_seconds',
    help: 'Duración de las solicitudes del orquestador',
    labelNames: ['method', 'route', 'status'],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  });

  readonly externalRequestsTotal = new Counter({
    name: 'orchestrator_external_requests_total',
    help: 'Solicitudes realizadas a APIs externas',
    labelNames: ['service', 'status'],
  });

  readonly externalRequestDuration = new Histogram({
    name: 'orchestrator_external_request_duration_seconds',
    help: 'Duración de llamadas a APIs externas',
    labelNames: ['service'],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
  });

  readonly sqsMessagesSent = new Counter({
    name: 'orchestrator_sqs_messages_sent_total',
    help: 'Mensajes enviados por el orquestador a SQS',
  });

  readonly sqsMessagesAvailable = new Gauge({
    name: 'orchestrator_sqs_messages_available',
    help: 'Mensajes disponibles aproximadamente en SQS',
  });

  constructor() {
    collectDefaultMetrics();
  }

  async getMetrics(): Promise<string> {
    return register.metrics();
  }
}