import { describe, expect, it, vi } from 'vitest';
import { UpdateEventTypeUseCase } from '@/apps/control-api/application/event-type';
import {
  EventType,
  EventTypeKey,
  EventTypeName,
  EventTypeRepository,
  EventTypeSchema,
} from '@/apps/control-api/domain/event-type';
import { UserRepository } from '@/apps/control-api/domain/user';
import { TransactionManager } from '@/shared/application';
import { unwrapOrThrow, ValidationErrors } from '@/shared/domain/common';

describe('UpdateEventTypeUseCase', () => {
  it('returns ValidationErrors for invalid schema', async () => {
    const eventType = EventType.create({
      key: unwrapOrThrow(EventTypeKey.create('button.clicked')),
      name: unwrapOrThrow(EventTypeName.create('Button Clicked')),
      description: null,
      schema: unwrapOrThrow(EventTypeSchema.create(null)),
      requiresExposure: false,
    });
    const createdEventType = unwrapOrThrow(eventType);
    const eventTypeRepository = {
      findById: vi.fn().mockResolvedValue(createdEventType),
      save: vi.fn(),
    } as unknown as EventTypeRepository;
    const userRepository = {
      findById: vi.fn().mockResolvedValue({ isAdmin: () => true }),
    } as unknown as UserRepository;
    const transactionManager = {
      execute: vi.fn(async (fn: () => Promise<unknown>) => fn()),
      stageDomainEvents: vi.fn(),
    } as unknown as TransactionManager;
    const useCase = new UpdateEventTypeUseCase(
      eventTypeRepository,
      userRepository,
      transactionManager,
    );
    const result = await useCase.execute({
      actorId: '3d7eca60-c43d-4d01-ac0e-a023484a22f6',
      eventTypeId: '0bcd9ec1-5e0c-49ba-a098-9b6d28749d6d',
      schema: [],
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(ValidationErrors);
    }
    expect(eventTypeRepository.save).not.toHaveBeenCalled();
  });
});
