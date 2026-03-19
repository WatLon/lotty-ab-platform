import { Injectable } from '@nestjs/common';
import { RuntimeEventTypeView } from '@/contracts/event-type-runtime';
import { AppLogger } from '@/shared/application';
import { RedisClientProvider } from '@/shared/infrastructure/cache/redis-client.provider';
import {
  EVENT_TYPE_CATALOG_REDIS_KEY,
  EVENT_TYPE_CATALOG_REDIS_STREAM,
} from '@/shared/infrastructure/event-type-catalog/event-type-catalog.constants';
import { PrismaService } from '@/shared/infrastructure/persistence';

@Injectable()
export class EventTypeProjection {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisProvider: RedisClientProvider,
    private readonly appLogger: AppLogger,
  ) {}

  async project(eventTypeId: string): Promise<void> {
    const eventType = await this.prisma.eventType.findUnique({
      where: { id: eventTypeId },
      select: {
        id: true,
        key: true,
        schema: true,
        requiresExposure: true,
        isArchived: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!eventType) return;

    const payload: RuntimeEventTypeView = {
      id: eventType.id,
      key: eventType.key,
      schema: eventType.schema,
      requiresExposure: eventType.requiresExposure,
      isArchived: eventType.isArchived,
      createdAt: eventType.createdAt.toISOString(),
      updatedAt: eventType.updatedAt?.toISOString() ?? null,
    };
    const serialized = JSON.stringify(payload);

    try {
      const redis = this.redisProvider.getClient();
      await redis.hset(EVENT_TYPE_CATALOG_REDIS_KEY, eventType.key, serialized);
      await redis.xadd(
        EVENT_TYPE_CATALOG_REDIS_STREAM,
        'MAXLEN',
        '~',
        '1000',
        '*',
        'eventTypeKey',
        eventType.key,
        'payload',
        serialized,
      );
    } catch (error) {
      this.appLogger.error(
        {
          event: 'event_type_catalog.publish_failed',
          domain: 'infrastructure',
          operation: 'EventTypeCatalogProjection.project',
          status: 'failure',
          meta: {
            eventTypeId: eventType.id,
            eventTypeKey: eventType.key,
          },
        },
        error,
        'failed to publish event type catalog to redis',
      );
    }
  }
}
