import { Prisma } from '@generated/prisma/client';
import { AppLogger } from '@/shared/application';
import { toError } from '@/shared/domain/common';
export async function prismaUpdateWithOptimisticLock(params: {
  appLogger: AppLogger;
  operation: string;
  entity: string;
  entityId: string;
  currentVersion: number;
  newVersion: number;
  update: () => Promise<void>;
}): Promise<boolean> {
  try {
    await params.update();
    return true;
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return false;
    }
    params.appLogger.error(
      {
        event: 'infrastructure.db.operation.failed',
        domain: 'infrastructure',
        operation: params.operation,
        status: 'failure',
        meta: {
          entity: params.entity,
          entityId: params.entityId,
          currentVersion: params.currentVersion,
          newVersion: params.newVersion,
        },
      },
      error,
      'database update failed',
    );
    throw toError(error);
  }
}
