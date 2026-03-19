import { FlagId } from '@/apps/control-api/domain/flag';
import { ConcurrencyError, Result } from '@/shared/domain/common';
import { ExperimentStatus } from './enums/experiment-status.enum';
import { ExperimentAlreadyExistsForFlagError } from './errors';
import { Experiment } from './experiment.aggregate-root';
import { ExperimentId } from './value-objects/experiment.id';

export abstract class ExperimentRepository {
  abstract findById(id: ExperimentId): Promise<Experiment | null>;

  abstract findActiveByFlagId(flagId: FlagId): Promise<Experiment | null>;

  abstract findByFlagIdAndStatuses(
    flagId: FlagId,
    statuses: ExperimentStatus[],
  ): Promise<Experiment[]>;

  abstract save(
    entity: Experiment,
  ): Promise<Result<void, ConcurrencyError | ExperimentAlreadyExistsForFlagError>>;

  abstract delete(id: ExperimentId): Promise<void>;
}
