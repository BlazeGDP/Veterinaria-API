import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NestInterceptor,
} from '@nestjs/common';
import { delay, Observable, throwError } from 'rxjs';

@Injectable()
export class CanaryFailureInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();

    const isCanary = process.env.APP_TRACK === 'canary';
    const firstHeader = (value: string | string[] | undefined) =>
      Array.isArray(value) ? value[0] : value;
    const smokeHeader = firstHeader(request.headers['x-canary']);
    const smokeToken = firstHeader(request.headers['x-canary-token']);
    const mode = firstHeader(request.headers['x-canary-failure']);
    const expectedToken = process.env.METRICS_BEARER_TOKEN;

    // La ruta de smoke-test y la inyección de fallos requieren el token secreto.
    // Las peticiones públicas normales a Canary no necesitan este header.
    if (
      isCanary &&
      (smokeHeader === 'true' || Boolean(mode)) &&
      (!expectedToken || smokeToken !== expectedToken)
    ) {
      return throwError(
        () => new ForbiddenException('La operación Canary requiere x-canary-token válido'),
      );
    }

    const enabled = isCanary && process.env.CANARY_FAILURE_ENABLED === 'true';
    if (!enabled) return next.handle();

    if (mode === '500') {
      return throwError(
        () => new InternalServerErrorException('Canary failure injected (HTTP 500)'),
      );
    }

    if (mode === 'latency') {
      const milliseconds = Math.min(
        Math.max(Number(process.env.CANARY_FAILURE_LATENCY_MS || '1500'), 100),
        10000,
      );
      return next.handle().pipe(delay(milliseconds));
    }

    return next.handle();
  }
}
