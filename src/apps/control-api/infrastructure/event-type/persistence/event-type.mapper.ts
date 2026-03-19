import { EventType as PrismaEventType } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import {
  EventType,
  EventTypeDescription,
  EventTypeId,
  EventTypeKey,
  EventTypeName,
  EventTypeSchema,
} from '@/apps/control-api/domain/event-type';
import { PersistenceMapper } from '@/shared/infrastructure/persistence';

@Injectable()
export class EventTypeMapper implements PersistenceMapper<EventType, PrismaEventType> {
  toDomain(raw: PrismaEventType): EventType {
    return EventType.reconstitute(
      {
        key: EventTypeKey.reconstitute(raw.key),
        name: EventTypeName.reconstitute(raw.name),
        description:
          raw.description === null ? null : EventTypeDescription.reconstitute(raw.description),
        schema: EventTypeSchema.reconstitute(raw.schema),
        requiresExposure: raw.requiresExposure,
        isArchived: raw.isArchived,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      },
      EventTypeId.from(raw.id),
    );
  }
}
