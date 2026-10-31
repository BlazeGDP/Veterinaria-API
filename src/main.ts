import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';

import { AppModule } from './app.module';
import { CanaryFailureInterceptor } from './observability/canary-failure.interceptor';
import { recordHttpRequest } from './observability/metrics';

async function bootstrap() {
  const fastifyAdapter = new FastifyAdapter();

  const fastify = fastifyAdapter.getInstance();

  fastify.addHook('onRequest', async (request) => {
    (request as typeof request & { __startedAt?: bigint }).__startedAt = process.hrtime.bigint();
  });

  fastify.addHook('onResponse', async (request, reply) => {
    const startedAt = (request as typeof request & { __startedAt?: bigint }).__startedAt;
    if (startedAt === undefined) return;
    const durationSeconds = Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
    const route = request.routeOptions?.url ?? request.url.split('?')[0];
    if (!route.startsWith('/metrics/')) {
      recordHttpRequest(request.method, route, reply.statusCode, durationSeconds);
    }
  });

  fastify.addHook('onSend', async (_request, reply, payload) => {
    reply.header('X-App-Version', process.env.APP_VERSION || 'local');
    reply.header('X-App-Track', process.env.APP_TRACK || 'local');
    return payload;
  });

  fastify.addHttpMethod('QUERY', {
    hasBody: true,
    overrideExisting: true,
  });

  const app =
    await NestFactory.create<NestFastifyApplication>(
      AppModule,
      fastifyAdapter,
    );

  app.useGlobalInterceptors(new CanaryFailureInterceptor());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port =
    Number(process.env.PORT) || 3000;

  await app.listen(
    port,
    '0.0.0.0',
  );
}

bootstrap();
