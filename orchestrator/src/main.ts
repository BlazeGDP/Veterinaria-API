import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

import { MetricsInterceptor } from './metrics/metrics.interceptor';
import { MetricsService } from './metrics/metrics.service';
import { TraceInterceptor } from './trace/trace.interceptor';

async function bootstrap() {
  const app =
    await NestFactory.create(
      AppModule,
    );

  app.enableShutdownHooks();

  const metricsService =
    app.get(MetricsService);

  app.useGlobalInterceptors(
    new TraceInterceptor(),
    new MetricsInterceptor(
      metricsService,
    ),
  );

  const port =
    Number(process.env.PORT) || 3000;

  await app.listen(
    port,
    '0.0.0.0',
  );
}

bootstrap();
