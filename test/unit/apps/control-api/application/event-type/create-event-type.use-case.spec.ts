import { describe, expect, it, vi } from 'vitest';
import { CreateEventTypeUseCase } from '@/apps/control-api/application/event-type';
import { EventTypeRepository } from '@/apps/control-api/domain/event-type';
import { UserRepository } from '@/apps/control-api/domain/user';
import { TransactionManager } from '@/shared/application';
import { ValidationErrors } from '@/shared/domain/common';

describe('CreateEventTypeUseCase', () => {
  it('returns ValidationErrors for invalid schema', async () => {
    const eventTypeRepository = {
      findByKey: vi.fn(),
      save: vi.fn(),
    } as unknown as EventTypeRepository;
    const userRepository = {
      findById: vi.fn().mockResolvedValue({ isAdmin: () => true }),
    } as unknown as UserRepository;
    const transactionManager = {
      execute: vi.fn(async (fn: () => Promise<unknown>) => fn()),
      stageDomainEvents: vi.fn(),
    } as unknown as TransactionManager;
    const useCase = new CreateEventTypeUseCase(
      eventTypeRepository,
      userRepository,
      transactionManager,
    );
    const result = await useCase.execute({
      actorId: '3d7eca60-c43d-4d01-ac0e-a023484a22f6',
      key: 'button.clicked',
      name: 'Button Clicked',
      description: null,
      schema: { type: 123 },
      requiresExposure: false,
    });
    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(ValidationErrors);
    }
    expect(eventTypeRepository.findByKey).not.toHaveBeenCalled();
    expect(eventTypeRepository.save).not.toHaveBeenCalled();
  });
});
