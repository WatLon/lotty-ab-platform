import { Injectable } from '@nestjs/common';
import { PaginatedResult, PaginationParams } from '@/shared/application/pagination';
import { ok, Result } from '@/shared/domain/common';
import { EventTypeOutput } from '../../event-type.output';
import { EventTypeReadRepository } from '../../event-type.read-repository';

@Injectable()
export class ListEventTypesUseCase {
  constructor(private readonly eventTypeReadRepository: EventTypeReadRepository) {}

  async execute(
    params?: PaginationParams,
  ): Promise<Result<PaginatedResult<EventTypeOutput>, never>> {
    const types = await this.eventTypeReadRepository.findAll(params ?? {});

    return ok(types);
  }
}
