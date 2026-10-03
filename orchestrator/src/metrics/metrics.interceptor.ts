import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';

import { Observable, throwError } from 'rxjs';
import { catchError, finalize } from 'rxjs/operators';

import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const httpContext = context.switchToHttp();

    const request = httpContext.getRequest();
    const response = httpContext.getResponse();

    const method = request.method;
    const route =
      request.route?.path ||
      request.url;

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