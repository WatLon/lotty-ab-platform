import { Module } from '@nestjs/common';
import {
  ArchiveLearningEntryUseCase,
  CreateLearningEntryUseCase,
  FindSimilarLearningsUseCase,
  GetLearningEntryUseCase,
  LearningEntryReadRepository,
  ListLearningEntriesUseCase,
  UpdateLearningEntryUseCase,
} from '@/apps/control-api/application/learning';
import { LearningEntryRepository } from '@/apps/control-api/domain/learning';
import { ExperimentModule } from '@/apps/control-api/infrastructure/experiment';
import { UserModule } from '@/apps/control-api/infrastructure/user';
import { LearningController } from '@/apps/control-api/presentation/learning';
import { LearningEntryMapper } from './persistence/learning-entry.mapper';
import { LearningEntryPrismaRepository } from './persistence/learning-entry.prisma-repository';
import { LearningEntryReadPrismaRepository } from './persistence/learning-entry.read-prisma-repository';

@Module({
  imports: [UserModule, ExperimentModule],
  controllers: [LearningController],
  providers: [
    CreateLearningEntryUseCase,
    UpdateLearningEntryUseCase,
    ArchiveLearningEntryUseCase,
    GetLearningEntryUseCase,
    ListLearningEntriesUseCase,
    FindSimilarLearningsUseCase,
    LearningEntryMapper,
    {
      provide: LearningEntryRepository,
      useClass: LearningEntryPrismaRepository,
    },
    {
      provide: LearningEntryReadRepository,
      useClass: LearningEntryReadPrismaRepository,
    },
  ],
  exports: [LearningEntryRepository, LearningEntryReadRepository],
})
export class LearningModule {}
