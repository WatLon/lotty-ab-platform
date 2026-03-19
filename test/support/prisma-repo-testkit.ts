import { Prisma } from '@generated/prisma/client';
import type { AppLogger } from '@/shared/application';

type LoggerCall = [Record<string, unknown>, unknown, string | undefined];

export function unwrap<T, E>(result: { isErr(): boolean; value?: T; error?: E }): T {
  if (result.isErr()) {
    throw result.error;
  }
  return result.value as T;
}

export function createKnownRequestError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('request failed', {
    code,
    clientVersion: 'test',
  } as never);
}

export function createAppLoggerSpy(): {
  appLogger: AppLogger;
  calls: LoggerCall[];
} {
  const calls: LoggerCall[] = [];
  const appLogger = {
    error: (event: Record<string, unknown>, error?: unknown, message?: string) => {
      calls.push([event, error, message]);
    },
  } as unknown as AppLogger;

  return { appLogger, calls };
}

export async function callDoUpdate<TRepository, TEntity>(
  repository: TRepository,
  entity: TEntity,
  currentVersion: number,
  newVersion: number,
): Promise<boolean> {
  type DoUpdateFn = (
    entity: TEntity,
    currentVersion: number,
    newVersion: number,
  ) => Promise<
    | boolean
    | {
        isErr(): boolean;
        value?: boolean;
        error?: unknown;
      }
  >;
  const fn = (repository as unknown as { doUpdate: DoUpdateFn }).doUpdate;
  const result = await fn.call(repository, entity, currentVersion, newVersion);
  if (typeof result === 'boolean') return result;
  if (result.isErr()) {
    throw result.error;
  }
  return result.value as boolean;
}
