import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Observable } from 'rxjs';

type TraceRequest = {
  headers: Record<string, string | string[] | undefined>;
  traceId?: string;
};

type TraceResponse = {
  setHeader: (name: string, value: string) => void;
};

@Injectable()
export class TraceInterceptor
  implements NestInterceptor
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    const request =
      context.switchToHttp().getRequest<TraceRequest>();
    const response =
      context.switchToHttp().getResponse<TraceResponse>();

    const incomingHeader =
      request.headers?.['x-trace-id'];

    const incomingTraceId =
      Array.isArray(incomingHeader)
        ? incomingHeader[0]
        : incomingHeader;

    const traceId =
      typeof incomingTraceId === 'string' &&
      incomingTraceId.trim().length > 0 &&
      incomingTraceId.length <= 128 &&
      /^[A-Za-z0-9._:-]+$/.test(
        incomingTraceId,
      )
        ? incomingTraceId
        : randomUUID();

    request.traceId = traceId;

    response.setHeader(
      'X-Trace-ID',
      traceId,
    );

    return next.handle();
  }
}
