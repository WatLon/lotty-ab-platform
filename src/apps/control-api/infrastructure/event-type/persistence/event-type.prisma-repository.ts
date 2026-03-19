import { Prisma, EventType as PrismaEventType } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import {
  EventType,
  EventTypeId,
  EventTypeKey,
  EventTypeKeyAlreadyExistsError,
  EventTypeRepository,
} from '@/apps/control-api/domain/event-type';
import { AppLogger } from '@/shared/application';
import { err, ok, Result, toError } from '@/shared/domain/common';
import {
  PrismaRepositoryBase,
  PrismaTransactionManager,
  prismaUpdateWithOptimisticLock,
  toPrismaNullableJson,
} from '@/shared/infrastructure/persistence';
import { EventTypeMapper } from './event-type.mapper';

@Injectable()
export class EventTypePrismaRepository
  extends PrismaRepositoryBase<
    EventType,
    PrismaEventType,
    EventTypeId,
    EventTypeKeyAlreadyExistsError
  >
  implements EventTypeRepository
{
  protected readonly entityName = 'EventType';

  constructor(
    txManager: PrismaTransactionManager,
    private readonly appLogger: AppLogger,
    mapper: EventTypeMapper,
  ) {
    super(txManager, mapper);
  }

  async findById(id: EventTypeId): Promise<EventType | null> {
    return this.findOne(this.client.eventType.findUnique({ where: { id: id.value } }));
  }

  async findByKey(key: EventTypeKey): Promise<EventType | null> {
    return this.findOne(this.client.eventType.findUnique({ where: { key: key.value } }));
  }

  async findByKeys(keys: EventTypeKey[]): Promise<EventType[]> {
    if (keys.length === 0) return [];

    const raw = await this.client.eventType.findMany({
      where: { key: { in: keys.map((k) => k.value) } },
    });
    return raw.map((r) => this.mapper.toDomain(r));
  }

  protected async doCreate(
    entity: EventType,
    version: number,
  ): Promise<Result<void, EventTypeKeyAlreadyExistsError>> {
    try {
      await this.client.eventType.create({
        data: {
          id: entity.id.value,
          key: entity.key.value,
          name: entity.name,
          description: entity.description,
          schema: toPrismaNullableJson(entity.schema, {
            nullSentinel: 'json',
            errorMessage: 'EventType.schema must be JSON-serializable',
          }),
          requiresExposure: entity.requiresExposure,
          isArchived: entity.isArchived,
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt ?? new Date(),
          version,
        },
      });
      return ok(undefined);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return err(new EventTypeKeyAlreadyExistsError(entity.key));
      }
      throw toError(error);
    }
  }

  protected async doUpdate(
    entity: EventType,
    currentVersion: number,
    newVersion: number,
  ): Promise<Result<boolean, EventTypeKeyAlreadyExistsError>> {
    try {
      const updated = await prismaUpdateWithOptimisticLock({
        appLogger: this.appLogger,
        operation: 'EventTypePrismaRepository.doUpdate',
        entity: this.entityName,
        entityId: entity.id.value,
        currentVersion,
        newVersion,
        update: async () => {
          await this.client.eventType.update({
            where: { id: entity.id.value, version: currentVersion },
            data: {
              name: entity.name,
              description: entity.description,
              schema: toPrismaNullableJson(entity.schema, {
                nullSentinel: 'json',
                errorMessage: 'EventType.schema must be JSON-serializable',
              }),
              requiresExposure: entity.requiresExposure,
              isArchived: entity.isArchived,
              updatedAt: entity.updatedAt ?? new Date(),
              version: newVersion,
            },
          });
        },
      });
      return ok(updated);
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return err(new EventTypeKeyAlreadyExistsError(entity.key));
      }
      throw toError(error);
    }
  }
}
