import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AppLogger } from '@/shared/application';
import { DomainError } from '@/shared/domain/common/errors';
import { domainErrorToHttpStatus } from '@/shared/presentation/common/filters/domain-error-status';
import { MetricsService } from '@/shared/presentation/metrics';

function getErrorStatusCode(error: unknown): number {
  if (error instanceof DomainError) return domainErrorToHttpStatus(error);

  if (error instanceof HttpException) return error.getStatus();

  if (error instanceof Error) {
    const candidate = error as Error & { status?: unknown; statusCode?: unknown };
    const status = candidate.status;
    if (typeof status === 'number') return status;

    const statusCode = candidate.statusCode;
    if (typeof statusCode === 'number') return statusCode;
  }

  return 500;
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(
    private readonly logger: AppLogger,
    private readonly metrics: MetricsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const response = context.switchToHttp().getResponse<FastifyReply>();
    const routePath =
      (request as FastifyRequest & { routerPath?: string }).routerPath ?? request.url;
    const operation = `${request.method} ${routePath}`;
    const start = Date.now();
    const skipAccessLogs = routePath === '/decide';
    if (!skipAccessLogs) {
      this.logger.info(
        {
          event: 'http.request.started',
          domain: 'http',
          operation,
          meta: { path: routePath },
        },
        'incoming request',
      );
    }
    return next.handle().pipe(
      tap({
        next: () => {
          this.metrics.incrementHttp(request.method, routePath, response.statusCode);
          if (!skipAccessLogs) {
            this.logger.info(
              {
                event: 'http.request.completed',
                domain: 'http',
                operation,
                status: 'success',
                statusCode: response.statusCode,
                durationMs: Date.now() - start,
                meta: { path: routePath },
              },
              'request completed',
            );
          }
        },
        error: (error: unknown) => {
          const statusCode = getErrorStatusCode(error);
          this.metrics.incrementHttp(request.method, routePath, statusCode);
          this.logger.error(
            {
              event: 'http.request.failed',
              domain: 'http',
              operation,
              status: 'failure',
              statusCode,
              durationMs: Date.now() - start,
              meta: { path: routePath },
            },
            error,
            'request failed',
          );
        },
      }),
    );
  }
}
