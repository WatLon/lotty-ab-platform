import { Injectable } from '@nestjs/common';
import { FlagId } from '@/apps/control-api/domain/flag';
import { err, NotFoundError, ok, Result } from '@/shared/domain/common';
import { FlagOutput } from '../../flag.output';
import { FlagReadRepository } from '../../flag.read-repository';
import { GetFlagQuery } from './get-flag.query';

@Injectable()
export class GetFlagUseCase {
  constructor(private readonly flagReadRepository: FlagReadRepository) {}

  async execute(query: GetFlagQuery): Promise<Result<FlagOutput, NotFoundError>> {
    const flag = await this.flagReadRepository.findById(query.flagId);
    if (!flag) {
      return err(new NotFoundError('flag', FlagId.from(query.flagId)));
    }
    return ok(flag);
  }
}
