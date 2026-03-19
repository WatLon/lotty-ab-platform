import { Injectable } from '@nestjs/common';
import {
  EmailAlreadyExistsError,
  Role,
  User,
  UserEmail,
  UserName,
  UserPassword,
  UserRepository,
} from '@/apps/control-api/domain/user';
import { TransactionManager } from '@/shared/application';
import {
  ConcurrencyError,
  err,
  ok,
  Result,
  ValidationErrors,
  validate,
} from '@/shared/domain/common';
import { PasswordHasher } from '../../password-hasher';
import { CreateUserCommand } from './create-user.command';

@Injectable()
export class CreateUserUseCase {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly transactionManager: TransactionManager,
  ) {}

  async execute(command: CreateUserCommand): Promise<
    Result<
      {
        id: string;
      },
      EmailAlreadyExistsError | ConcurrencyError | ValidationErrors
    >
  > {
    return this.transactionManager.execute(async () => {
      const validation = validate({
        email: UserEmail.create(command.email),
        password: UserPassword.validatePlain(command.password),
        name: UserName.create(command.name),
      });

      if (validation.isErr()) {
        return err(validation.error);
      }

      const { email, name } = validation.value;
      const existing = await this.userRepository.findByEmail(email);

      if (existing) {
        return err(new EmailAlreadyExistsError(email));
      }

      const role = command.role ?? Role.VIEWER;
      const hashedPassword = await this.passwordHasher.hash(command.password);
      const password = UserPassword.fromHashed(hashedPassword);
      const userResult = User.create({ email, password, name, role });

      if (userResult.isErr()) {
        return err(userResult.error);
      }

      const user = userResult.value;
      const saveResult = await this.userRepository.save(user);

      if (saveResult.isErr()) {
        return err(saveResult.error);
      }

      return ok({ id: user.id.value });
    });
  }
}
