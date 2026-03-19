import { Injectable } from '@nestjs/common';
import { UserId } from '@/apps/control-api/domain/user';
import { err, NotFoundError, ok, Result } from '@/shared/domain/common';
import { UserOutput } from '../../user.output';
import { UserReadRepository } from '../../user.read-repository';
import { GetUserQuery } from './get-user.query';

@Injectable()
export class GetUserUseCase {
  constructor(private readonly userReadRepository: UserReadRepository) {}

  async execute(query: GetUserQuery): Promise<Result<UserOutput, NotFoundError>> {
    const user = await this.userReadRepository.findById(query.userId);
    if (!user) {
      return err(new NotFoundError('user', UserId.from(query.userId)));
    }
    return ok(user);
  }
}
