import { Module } from '@nestjs/common';
import {
  ArchiveEventTypeUseCase,
  CreateEventTypeUseCase,
  EventTypeReadRepository,
  ListEventTypesUseCase,
  UpdateEventTypeUseCase,
} from '@/apps/control-api/application/event-type';
import { EventTypeRepository } from '@/apps/control-api/domain/event-type';
import { EventTypeController } from '@/apps/control-api/presentation/event-type';
import { UserModule } from '../user';
import { EventTypeMapper } from './persistence/event-type.mapper';
import { EventTypePrismaRepository } from './persistence/event-type.prisma-repository';
import { EventTypeReadPrismaRepository } from './persistence/event-type.read-prisma-repository';

@Module({
  imports: [UserModule],
  controllers: [EventTypeController],
  providers: [
    CreateEventTypeUseCase,
    UpdateEventTypeUseCase,
    ArchiveEventTypeUseCase,
    ListEventTypesUseCase,
    EventTypeMapper,
    { provide: EventTypeRepository, useClass: EventTypePrismaRepository },
    { provide: EventTypeReadRepository, useClass: EventTypeReadPrismaRepository },
  ],
  exports: [EventTypeRepository, EventTypeReadRepository],
})
export class EventTypeModule {}
