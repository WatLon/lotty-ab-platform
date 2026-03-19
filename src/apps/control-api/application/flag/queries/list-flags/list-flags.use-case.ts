import { Injectable } from '@nestjs/common';
import { PaginatedResult, PaginationParams } from '@/shared/application/pagination';
import { ok, Result } from '@/shared/domain/common';
import { FlagOutput } from '../../flag.output';
import { FlagReadRepository } from '../../flag.read-repository';

@Injectable()
export class ListFlagsUseCase {
  constructor(private readonly flagReadRepository: FlagReadRepository) {}

  async execute(params?: PaginationParams): Promise<Result<PaginatedResult<FlagOutput>, never>> {
    const flags = await this.flagReadRepository.findAll(params ?? {});
    return ok(flags);
  }
}
