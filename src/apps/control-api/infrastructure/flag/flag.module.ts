import { Module } from '@nestjs/common';
import {
  CreateFlagUseCase,
  FlagReadRepository,
  GetFlagUseCase,
  ListFlagsUseCase,
  UpdateFlagUseCase,
} from '@/apps/control-api/application/flag';
import { FlagRepository } from '@/apps/control-api/domain/flag';
import { FlagController } from '@/apps/control-api/presentation/flag';
import { UserModule } from '../user';
import { FlagMapper } from './persistence/flag.mapper';
import { FlagPrismaRepository } from './persistence/flag.prisma-repository';
import { FlagReadPrismaRepository } from './persistence/flag.read-prisma-repository';

@Module({
  imports: [UserModule],
  controllers: [FlagController],
  providers: [
    CreateFlagUseCase,
    UpdateFlagUseCase,
    GetFlagUseCase,
    ListFlagsUseCase,
    FlagMapper,
    { provide: FlagRepository, useClass: FlagPrismaRepository },
    { provide: FlagReadRepository, useClass: FlagReadPrismaRepository },
  ],
  exports: [FlagRepository, FlagReadRepository],
})
export class FlagModule {}
