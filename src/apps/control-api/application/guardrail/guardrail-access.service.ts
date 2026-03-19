import { Injectable } from '@nestjs/common';
import {
  Experiment,
  ExperimentId,
  ExperimentRepository,
} from '@/apps/control-api/domain/experiment';
import { User, UserId, UserRepository } from '@/apps/control-api/domain/user';
import { err, ForbiddenError, NotFoundError, ok, Result } from '@/shared/domain/common';

export interface GuardrailAccessContext {
  actorId: UserId;
  actor: User;
  experimentId: ExperimentId;
  experiment: Experiment;
}

@Injectable()
export class GuardrailAccessService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly experimentRepository: ExperimentRepository,
  ) {}

  async requireExperimentAccess(
    actorIdRaw: string,
    experimentIdRaw: string,
  ): Promise<Result<GuardrailAccessContext, NotFoundError | ForbiddenError>> {
    const actorId = UserId.from(actorIdRaw);
    const actor = await this.userRepository.findById(actorId);
    if (!actor) return err(new NotFoundError('user', actorId));

    const experimentId = ExperimentId.from(experimentIdRaw);
    const experiment = await this.experimentRepository.findById(experimentId);
    if (!experiment) return err(new NotFoundError('experiment', experimentId));

    if (!actor.isAdmin() && !experiment.ownerId.equals(actorId)) {
      return err(new ForbiddenError('guardrail', experimentId));
    }

    return ok({ actorId, actor, experimentId, experiment });
  }
}
