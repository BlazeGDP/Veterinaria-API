import {
  BadGatewayException,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';

import {
  GetQueueAttributesCommand,
  SQSClient,
  SendMessageCommand,
} from '@aws-sdk/client-sqs';

import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class OrchestratorService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger =
    new Logger(OrchestratorService.name);

  private readonly awsApiUrl =
    process.env.AWS_API_URL ||
    'http://ae7646e6cf2b74912906f40f9a30539d-032ee795ec92fbaf.elb.us-east-2.amazonaws.com';

  private readonly awsApiMetricsUrl =
    process.env.AWS_API_METRICS_URL || '';

  private readonly gcpApiMetricsUrl =
    process.env.GCP_API_METRICS_URL ||
    'http://34.10.12.227/metrics';

  private readonly azureApiMetricsUrl =
    process.env.AZURE_API_METRICS_URL ||
    'http://57.169.3.252/metrics';

  private readonly queueUrl =
    process.env.SQS_QUEUE_URL || '';

  private readonly sqs = new SQSClient({
    region:
      process.env.AWS_REGION || 'us-east-2',
  });

  private queueMetricsInterval?: NodeJS.Timeout;

  constructor(
    private readonly metrics: MetricsService,
  ) {}

  onModuleInit() {
    this.updateQueueMetrics();

    this.queueMetricsInterval =
      setInterval(
        () => {
          this.updateQueueMetrics();
        },
        30_000,
      );
  }

  onModuleDestroy() {
    if (this.queueMetricsInterval) {
      clearInterval(
        this.queueMetricsInterval,
      );
    }
  }

  async getOwners(
    traceId: string,
  ): Promise<unknown> {
    return this.callExternalApi(
      `${this.awsApiUrl}/owners`,
      'aws',
      traceId,
    );
  }

  async getOwnerById(
    id: string,
    traceId: string,
  ): Promise<unknown> {
    return this.callExternalApi(
      `${this.awsApiUrl}/owners/${encodeURIComponent(id)}`,
      'aws',
      traceId,
    );
  }

  async getPets(
    traceId: string,
  ): Promise<unknown> {
    return this.callExternalApi(
      `${this.awsApiUrl}/pets`,
      'aws',
      traceId,
    );
  }

  async getPetById(
    id: string,
    traceId: string,
  ): Promise<unknown> {
    return this.callExternalApi(
      `${this.awsApiUrl}/pets/${encodeURIComponent(id)}`,
      'aws',
      traceId,
    );
  }

  async getAppointments(
    traceId: string,
  ): Promise<unknown> {
    return this.callExternalApi(
      `${this.awsApiUrl}/appointments`,
      'aws',
      traceId,
    );
  }

  async getAppointmentById(
    id: string,
    traceId: string,
  ): Promise<unknown> {
    return this.callExternalApi(
      `${this.awsApiUrl}/appointments/${encodeURIComponent(id)}`,
      'aws',
      traceId,
    );
  }

  async sendMessage(
    type: string,
    payload: Record<string, unknown>,
    traceId: string,
  ) {
    if (!this.queueUrl) {
      throw new BadGatewayException(
        'SQS_QUEUE_URL no está configurada',
      );
    }

    try {
      const command =
        new SendMessageCommand({
          QueueUrl: this.queueUrl,
          MessageBody: JSON.stringify({
            type,
            payload,
            traceId,
            timestamp:
              new Date().toISOString(),
          }),
        });

      const result =
        await this.sqs.send(command);

      this.metrics.sqsMessagesSent.inc();

      this.logger.log(
        `[TRACE ${traceId}] Mensaje enviado a SQS`,
      );

      return {
        messageId: result.MessageId,
        sent: true,
        traceId,
      };
    } catch (error) {
      this.logger.error(
        `[TRACE ${traceId}] Error enviando mensaje a SQS: ${
          error instanceof Error
            ? error.message
            : 'error desconocido'
        }`,
      );

      throw new BadGatewayException(
        `Error enviando mensaje a SQS: ${
          error instanceof Error
            ? error.message
            : 'error desconocido'
        }`,
      );
    }
  }

  async getAwsMetrics(
    traceId: string,
  ): Promise<string> {
    return this.getExternalMetrics(
      this.awsApiMetricsUrl,
      'aws',
      traceId,
    );
  }

  async getGcpMetrics(
    traceId: string,
  ): Promise<string> {
    return this.getExternalMetrics(
      this.gcpApiMetricsUrl,
      'gcp',
      traceId,
    );
  }

  async getAzureMetrics(
    traceId: string,
  ): Promise<string> {
    return this.getExternalMetrics(
      this.azureApiMetricsUrl,
      'azure',
      traceId,
    );
  }

  private async getExternalMetrics(
    url: string,
    service: string,
    traceId: string,
  ): Promise<string> {
    if (!url) {
      throw new BadGatewayException(
        `URL de métricas de ${service} no configurada`,
      );
    }

    return this.callExternalApiText(
      url,
      service,
      traceId,
    );
  }

  private async callExternalApiText(
    url: string,
    service: string,
    traceId: string,
  ): Promise<string> {
    const start =
      process.hrtime.bigint();
    let metricStatus = 'error';

    try {
      this.logger.log(
        `[TRACE ${traceId}] Consultando métricas de ${service}: ${url}`,
      );

      const response = await fetch(
        url,
        {
          method: 'GET',
          headers: {
            'X-Trace-ID': traceId,
          },
          signal:
            AbortSignal.timeout(10_000),
        },
      );

      metricStatus =
        response.status.toString();

      if (!response.ok) {
        throw new BadGatewayException(
          `La API ${service} respondió ${response.status}`,
        );
      }

      return await response.text();
    } catch (error) {
      this.logger.error(
        `[TRACE ${traceId}] Error consultando métricas de ${service}: ${
          error instanceof Error
            ? error.message
            : 'error desconocido'
        }`,
      );

      if (
        error instanceof
        BadGatewayException
      ) {
        throw error;
      }

      throw new BadGatewayException(
        `No se pudo obtener métricas de ${service}: ${
          error instanceof Error
            ? error.message
            : 'error desconocido'
        }`,
      );
    } finally {
      const duration =
        Number(
          process.hrtime.bigint() -
            start,
        ) / 1_000_000_000;

      this.metrics.externalRequestDuration
        .labels(service)
        .observe(duration);

      this.metrics.externalRequestsTotal
        .labels(
          service,
          metricStatus,
        )
        .inc();
    }
  }

  private async callExternalApi(
    url: string,
    service: string,
    traceId: string,
  ): Promise<unknown> {
    const start =
      process.hrtime.bigint();
    let metricStatus = 'error';

    try {
      this.logger.log(
        `[TRACE ${traceId}] Consultando ${service}: ${url}`,
      );

      const response = await fetch(
        url,
        {
          method: 'GET',
          headers: {
            'X-Trace-ID': traceId,
          },
          signal:
            AbortSignal.timeout(10_000),
        },
      );

      metricStatus =
        response.status.toString();

      if (!response.ok) {
        throw new BadGatewayException(
          `La API ${service} respondió ${response.status}`,
        );
      }

      return await response.json();
    } catch (error) {
      this.logger.error(
        `[TRACE ${traceId}] Error consultando ${service}: ${
          error instanceof Error
            ? error.message
            : 'error desconocido'
        }`,
      );

      if (
        error instanceof
        BadGatewayException
      ) {
        throw error;
      }

      throw new BadGatewayException(
        `No se pudo contactar la API ${service}: ${
          error instanceof Error
            ? error.message
            : 'error desconocido'
        }`,
      );
    } finally {
      const duration =
        Number(
          process.hrtime.bigint() -
            start,
        ) / 1_000_000_000;

      this.metrics.externalRequestDuration
        .labels(service)
        .observe(duration);

      this.metrics.externalRequestsTotal
        .labels(
          service,
          metricStatus,
        )
        .inc();
    }
  }

  private async updateQueueMetrics(): Promise<void> {
    if (!this.queueUrl) {
      return;
    }

    try {
      const command =
        new GetQueueAttributesCommand({
          QueueUrl: this.queueUrl,
          AttributeNames: [
            'ApproximateNumberOfMessages',
            'ApproximateNumberOfMessagesNotVisible',
          ],
        });

      const result =
        await this.sqs.send(command);

      const available = Number(
        result.Attributes
          ?.ApproximateNumberOfMessages || 0,
      );

      const notVisible = Number(
        result.Attributes
          ?.ApproximateNumberOfMessagesNotVisible ||
          0,
      );

      this.metrics.sqsMessagesAvailable.set(
        available + notVisible,
      );
    } catch (error) {
      this.logger.warn(
        `No se pudo actualizar la métrica de SQS: ${
          error instanceof Error
            ? error.message
            : 'error desconocido'
        }`,
      );
    }
  }
}
