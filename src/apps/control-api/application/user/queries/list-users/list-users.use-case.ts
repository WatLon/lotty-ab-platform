import { Injectable } from '@nestjs/common';
import { PaginatedResult, PaginationParams } from '@/shared/application/pagination';
import { ok, Result } from '@/shared/domain/common';
import { UserOutput } from '../../user.output';
import { UserReadRepository } from '../../user.read-repository';

@Injectable()
export class ListUsersUseCase {
  constructor(private readonly userReadRepository: UserReadRepository) {}

  async execute(params?: PaginationParams): Promise<Result<PaginatedResult<UserOutput>, never>> {
    const result = await this.userReadRepository.findAll(params ?? {});
    return ok(result);
  }
}
