import { Module } from '@nestjs/common';
import { ArchiveExperimentUseCase } from '@/apps/control-api/application/experiment/commands/archive-experiment/archive-experiment.use-case';
import { CompleteExperimentUseCase } from '@/apps/control-api/application/experiment/commands/complete-experiment/complete-experiment.use-case';
import { CreateExperimentUseCase } from '@/apps/control-api/application/experiment/commands/create-experiment/create-experiment.use-case';
import { PauseExperimentUseCase } from '@/apps/control-api/application/experiment/commands/pause-experiment/pause-experiment.use-case';
import { ResumeExperimentUseCase } from '@/apps/control-api/application/experiment/commands/resume-experiment/resume-experiment.use-case';
import { StartExperimentUseCase } from '@/apps/control-api/application/experiment/commands/start-experiment/start-experiment.use-case';
import { SubmitForReviewUseCase } from '@/apps/control-api/application/experiment/commands/submit-for-review/submit-for-review.use-case';
import { SubmitReviewUseCase } from '@/apps/control-api/application/experiment/commands/submit-review/submit-review.use-case';
import { UpdateExperimentUseCase } from '@/apps/control-api/application/experiment/commands/update-experiment/update-experiment.use-case';
import { ExperimentReadRepository } from '@/apps/control-api/application/experiment/experiment.read-repository';
import { GetExperimentUseCase } from '@/apps/control-api/application/experiment/queries/get-experiment/get-experiment.use-case';
import { ListExperimentsUseCase } from '@/apps/control-api/application/experiment/queries/list-experiments/list-experiments.use-case';
import { ListReviewsUseCase } from '@/apps/control-api/application/experiment/queries/list-reviews/list-reviews.use-case';
import { ExperimentRepository } from '@/apps/control-api/domain/experiment/experiment.repository';
import { ExperimentReviewService } from '@/apps/control-api/domain/experiment/services/experiment-review.service';
import { ExperimentController } from '@/apps/control-api/presentation/experiment/experiment.controller';
import { ApproverGroupModule } from '../approver-group/approver-group.module';
import { FlagModule } from '../flag/flag.module';
import { MetricModule } from '../metric/metric.module';
import { UserModule } from '../user/user.module';
import { ExperimentEventSerializer } from './persistence/experiment.event-serializer';
import { ExperimentEventStoreRepository } from './persistence/experiment.event-store-repository';
import { ExperimentReadPrismaRepository } from './persistence/experiment.read-prisma-repository';

@Module({
  imports: [UserModule, FlagModule, MetricModule, ApproverGroupModule],
  controllers: [ExperimentController],
  providers: [
    CreateExperimentUseCase,
    UpdateExperimentUseCase,
    SubmitForReviewUseCase,
    SubmitReviewUseCase,
    StartExperimentUseCase,
    PauseExperimentUseCase,
    ResumeExperimentUseCase,
    CompleteExperimentUseCase,
    ArchiveExperimentUseCase,
    GetExperimentUseCase,
    ListExperimentsUseCase,
    ListReviewsUseCase,

    ExperimentReviewService,
    ExperimentEventSerializer,

    { provide: ExperimentRepository, useClass: ExperimentEventStoreRepository },
    { provide: ExperimentReadRepository, useClass: ExperimentReadPrismaRepository },
  ],
  exports: [ExperimentRepository, ExperimentReadRepository],
})
export class ExperimentModule {}
