import { Injectable } from '@nestjs/common';
import { LearningEntryId, LearningEntryRepository } from '@/apps/control-api/domain/learning';
import { UserId, UserRepository } from '@/apps/control-api/domain/user';
import { TransactionManager } from '@/shared/application';
import {
  ConcurrencyError,
  err,
  ForbiddenError,
  NotFoundError,
  ok,
  Result,
} from '@/shared/domain/common';
import { ArchiveLearningEntryCommand } from './archive-learning-entry.command';

@Injectable()
export class ArchiveLearningEntryUseCase {
  constructor(
    private readonly entries: LearningEntryRepository,
    private readonly users: UserRepository,
    private readonly txManager: TransactionManager,
  ) {}

  async execute(
    command: ArchiveLearningEntryCommand,
  ): Promise<Result<void, NotFoundError | ForbiddenError | ConcurrencyError>> {
    return this.txManager.execute(async () => {
      const actorId = UserId.from(command.actorId);
      const actor = await this.users.findById(actorId);
      if (!actor) return err(new NotFoundError('user', actorId));

      if (!actor.isExperimenter()) return err(new ForbiddenError('learningEntry', actorId));

      const learningId = LearningEntryId.from(command.learningId);
      const entry = await this.entries.findById(learningId);
      if (!entry) return err(new NotFoundError('learningEntry', learningId));

      entry.archive(actor.id);

      const saveResult = await this.entries.save(entry);
      if (saveResult.isErr()) return err(saveResult.error);

      return ok(undefined);
    });
  }
}
