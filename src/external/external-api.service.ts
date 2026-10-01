import {
  Injectable,
  Logger,
} from '@nestjs/common';

import { MetricsService } from '../metrics/metrics.service';

@Injectable()
export class ExternalApiService {
  private readonly logger = new Logger(
    ExternalApiService.name,
  );

  private readonly gcpJuegosUrl =
    process.env.GCP_JUEGOS_URL ||
    'http://34.10.12.227/juegos';

  private readonly azureTareasUrl =
    process.env.AZURE_TAREAS_URL ||
    'http://57.169.3.252/tareas';

  constructor(
    private readonly metrics: MetricsService,
  ) {}

  async appendRandomExternalEntities<T>(
    items: T[],
    traceId: string,
  ): Promise<unknown[]> {
    const [juego, tarea] = await Promise.all([
      this.getRandomJuego(traceId),
      this.getRandomTarea(traceId),
    ]);

    return [
      ...items,
      ...(juego !== null ? [juego] : []),
      ...(tarea !== null ? [tarea] : []),
    ];
  }

  async getRandomJuego(
    traceId: string,
  ): Promise<unknown | null> {
    const juegos = await this.getList(
      this.gcpJuegosUrl,
      'gcp',
      traceId,
    );

    if (juegos.length === 0) {
      return null;
    }

    return juegos[
      Math.floor(Math.random() * juegos.length)
    ];
  }

  async getRandomTarea(
    traceId: string,
  ): Promise<unknown | null> {
    const tareas = await this.getList(
      this.azureTareasUrl,
      'azure',
      traceId,
    );

    if (tareas.length === 0) {
      return null;
    }

    return tareas[
      Math.floor(Math.random() * tareas.length)
    ];
  }

  private async getList(
    url: string,
    service: 'gcp' | 'azure',
    traceId: string,
  ): Promise<unknown[]> {
    const start = process.hrtime.bigint();
    let metricStatus = 'error';

    try {
      this.logger.log(
        `[TRACE ${traceId}] Consultando ${service}: ${url}`,
      );

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'X-Trace-ID': traceId,
        },
        signal: AbortSignal.timeout(10000),
      });

      metricStatus = response.status.toString();

      if (!response.ok) {
        this.logger.error(
          `[TRACE ${traceId}] ${service} respondió ${response.status}: ${url}`,
        );

        return [];
      }

      const data: unknown = await response.json();

      if (!Array.isArray(data)) {
        this.logger.error(
          `[TRACE ${traceId}] ${service} no devolvió una lista en ${url}`,
        );

        metricStatus = 'invalid_response';
        return [];
      }

      this.logger.log(
        `[TRACE ${traceId}] ${service} respondió correctamente con ${data.length} registros`,
      );

      return data;
    } catch (error) {
      this.logger.error(
        `[TRACE ${traceId}] Error consultando ${service}: ${
          error instanceof Error
            ? error.message
            : 'error desconocido'
        }`,
      );

      return [];
    } finally {
      const duration =
        Number(process.hrtime.bigint() - start) /
        1_000_000_000;

      this.metrics.externalRequestDuration
        .labels(service)
        .observe(duration);

      this.metrics.externalRequestsTotal
        .labels(service, metricStatus)
        .inc();
    }
  }
}
