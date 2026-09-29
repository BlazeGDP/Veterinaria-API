import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';

import { Observable } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';
import { throwError } from 'rxjs';

import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const method = request.method;
    const route = request.routeOptions?.url || request.url;

    const start = process.hrtime.bigint();

    let status = 200;

    return next.handle().pipe(
      catchError((error) => {
        status = error?.status || 500;
        return throwError(() => error);
      }),
      finalize(() => {
        const duration =
          Number(process.hrtime.bigint() - start) / 1_000_000_000;

        status = response.statusCode || status;

        this.metrics.requestsTotal
          .labels(method, route, status.toString())
          .inc();

        this.metrics.requestDuration
          .labels(method, route, status.toString())
          .observe(duration);
      }),
    );
  }
}