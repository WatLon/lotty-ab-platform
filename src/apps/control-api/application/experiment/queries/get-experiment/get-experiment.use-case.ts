import { Injectable } from '@nestjs/common';
import { ExperimentId } from '@/apps/control-api/domain/experiment';
import { err, NotFoundError, ok, Result } from '@/shared/domain/common';
import { ExperimentOutput } from '../../experiment.output';
import { ExperimentReadRepository } from '../../experiment.read-repository';
import { GetExperimentQuery } from './get-experiment.query';

@Injectable()
export class GetExperimentUseCase {
  constructor(private readonly experimentReadRepository: ExperimentReadRepository) {}

  async execute(query: GetExperimentQuery): Promise<Result<ExperimentOutput, NotFoundError>> {
    const experiment = await this.experimentReadRepository.findById(query.experimentId);
    if (!experiment) {
      return err(new NotFoundError('experiment', ExperimentId.from(query.experimentId)));
    }
    return ok(experiment);
  }
}
