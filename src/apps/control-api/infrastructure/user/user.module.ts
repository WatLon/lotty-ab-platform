import { Module } from '@nestjs/common';
import {
  ChangeRoleUseCase,
  CreateUserUseCase,
  DeleteUserUseCase,
  GetUserUseCase,
  ListUsersUseCase,
  UpdateUserUseCase,
  UserReadRepository,
} from '@/apps/control-api/application/user';
import { UserRepository } from '@/apps/control-api/domain/user';
import { AuthModule } from '@/apps/control-api/infrastructure/auth';
import { UserController } from '@/apps/control-api/presentation/user';
import { UserMapper } from './persistence/user.mapper';
import { UserPrismaRepository } from './persistence/user.prisma-repository';
import { UserReadPrismaRepository } from './persistence/user.read-prisma-repository';

@Module({
  imports: [AuthModule],
  controllers: [UserController],
  providers: [
    CreateUserUseCase,
    UpdateUserUseCase,
    ChangeRoleUseCase,
    DeleteUserUseCase,
    GetUserUseCase,
    ListUsersUseCase,
    UserMapper,
    { provide: UserRepository, useClass: UserPrismaRepository },
    { provide: UserReadRepository, useClass: UserReadPrismaRepository },
  ],
  exports: [UserRepository, UserReadRepository],
})
export class UserModule {}
