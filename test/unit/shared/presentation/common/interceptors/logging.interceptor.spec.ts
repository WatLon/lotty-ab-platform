import { CallHandler, ExecutionContext } from '@nestjs/common';
import { firstValueFrom, Observable, of, throwError } from 'rxjs';
import { AppLogger } from '@/shared/application';
import { LoggingInterceptor } from '@/shared/presentation/common/interceptors/logging.interceptor';
import { MetricsService } from '@/shared/presentation/metrics';

interface LoggerCalls {
  info: Array<[Record<string, unknown>, string | undefined]>;
  error: Array<[Record<string, unknown>, unknown, string | undefined]>;
}

function createLoggerStub(): { logger: AppLogger; calls: LoggerCalls } {
  const calls: LoggerCalls = { info: [], error: [] };

  const logger = {
    info: (event: Record<string, unknown>, message?: string) => {
      calls.info.push([event, message]);
    },
    error: (event: Record<string, unknown>, error?: unknown, message?: string) => {
      calls.error.push([event, error, message]);
    },
  } as unknown as AppLogger;

  return { logger, calls };
}

function createMetricsStub(): MetricsService {
  return {
    increment: () => undefined,
    incrementHttp: () => undefined,
    renderPrometheus: () => '',
  } as unknown as MetricsService;
}

function createExecutionContext(
  request: Record<string, unknown>,
  response: Record<string, unknown>,
) {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
}

function createCallHandler(handle: () => Observable<unknown>): CallHandler {
  return { handle };
}

describe('LoggingInterceptor', () => {
  it('logs request start and completion', async () => {
    const { logger, calls } = createLoggerStub();
    const interceptor = new LoggingInterceptor(logger, createMetricsStub());

    const request = {
      method: 'GET',
      route: { path: '/users/:id' },
      originalUrl: '/users/123?verbose=true',
      headers: {},
    };
    const response = { statusCode: 200 };

    const context = createExecutionContext(request, response);
    const next = createCallHandler(() => of({ ok: true }));

    await firstValueFrom(interceptor.intercept(context, next));

    expect(calls.info).toHaveLength(2);
    expect(calls.info[0][0].event).toBe('http.request.started');
    expect(calls.info[0][1]).toBe('incoming request');
    expect(calls.info[1][0].event).toBe('http.request.completed');
    expect(calls.info[1][0].statusCode).toBe(200);
    expect(calls.info[1][1]).toBe('request completed');
    expect(calls.error).toHaveLength(0);
  });

  it('logs request failure and rethrows error', async () => {
    const { logger, calls } = createLoggerStub();
    const interceptor = new LoggingInterceptor(logger, createMetricsStub());
    const failure = Object.assign(new Error('boom'), { status: 418 });

    const request = {
      method: 'POST',
      originalUrl: '/experiments',
      headers: {},
    };
    const response = { statusCode: 500 };

    const context = createExecutionContext(request, response);
    const next = createCallHandler(() => throwError(() => failure));

    await expect(firstValueFrom(interceptor.intercept(context, next))).rejects.toThrow('boom');

    expect(calls.info).toHaveLength(1);
    expect(calls.error).toHaveLength(1);
    expect(calls.error[0][0].event).toBe('http.request.failed');
    expect(calls.error[0][0].statusCode).toBe(418);
    expect(calls.error[0][1]).toBe(failure);
    expect(calls.error[0][2]).toBe('request failed');
  });
});
