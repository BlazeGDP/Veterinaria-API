import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';

@Injectable()
export class ExternalApiService {
  private readonly logger = new Logger(ExternalApiService.name);

  private readonly gcpJuegosUrl =
    process.env.GCP_JUEGOS_URL || 'http://34.10.12.227/juegos';

  private readonly azureTareasUrl =
    process.env.AZURE_TAREAS_URL || 'http://57.169.3.252/tareas';

  async getJuegos(): Promise<unknown> {
    return this.getFromExternalApi(this.gcpJuegosUrl);
  }

  async getJuegoById(id: string): Promise<unknown> {
    return this.getFromExternalApi(
      `${this.gcpJuegosUrl}/${encodeURIComponent(id)}`,
    );
  }

  async getTareas(): Promise<unknown> {
    return this.getFromExternalApi(this.azureTareasUrl);
  }

  async getTareaById(id: string): Promise<unknown> {
    return this.getFromExternalApi(
      `${this.azureTareasUrl}/${encodeURIComponent(id)}`,
    );
  }

  private async getFromExternalApi(url: string): Promise<unknown> {
    try {
      this.logger.log(`Consultando API externa: ${url}`);

      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        this.logger.error(
          `API externa respondió ${response.status}: ${url}`,
        );

        throw new HttpException(
          {
            statusCode: response.status,
            message: `La API externa respondió con estado ${response.status}`,
          },
          response.status,
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `Error consultando API externa: ${
          error instanceof Error ? error.message : error
        }`,
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_GATEWAY,
          message: 'No fue posible comunicarse con la API externa',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}