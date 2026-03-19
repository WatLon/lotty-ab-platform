import { Module } from '@nestjs/common';
import {
  DecideUseCase,
  DecisionAnalyticsRepository,
  RuntimeSnapshotProvider,
} from '@/apps/decide-api/application';
import { ExperimentAssignmentService } from '@/apps/decide-api/application/services/experiment-assignment.service';
import { FlagResolver } from '@/apps/decide-api/application/services/flag.resolver';
import { ParticipationLimiter } from '@/apps/decide-api/application/subject-participation/participation-limiter';
import { DecideService } from '@/apps/decide-api/domain/decide.service';
import { ParticipationPolicy } from '@/apps/decide-api/domain/subject-participation/participation-policy';
import { DecideController } from '@/apps/decide-api/presentation';
import { DecisionTokenSigner } from '@/contracts/decision-token';
import { TargetingRuleEvaluator, TargetingRuleParser } from '@/shared/domain/targeting';
import { TypedConfigService } from '@/shared/infrastructure/config';
import { CryptoService } from '@/shared/infrastructure/security';
import { DecisionKafkaLogRepository } from './decision-log.producer';
import { RuntimeSnapshotConsumerService } from './runtime-snapshot.consumer.service';
import { InMemoryRuntimeSnapshotProvider } from './runtime-snapshot.provider';
import { RedisParticipationLimiter } from './subject-participation/redis-participation-limiter';

@Module({
  controllers: [DecideController],
  providers: [
    InMemoryRuntimeSnapshotProvider,
    RuntimeSnapshotConsumerService,
    {
      provide: RuntimeSnapshotProvider,
      useExisting: InMemoryRuntimeSnapshotProvider,
    },
    DecideUseCase,
    RedisParticipationLimiter,
    { provide: ParticipationLimiter, useExisting: RedisParticipationLimiter },
    {
      provide: ParticipationPolicy,
      useFactory: (config: TypedConfigService) =>
        new ParticipationPolicy({
          maxConcurrentExperiments: config.get('SUBJECT_PARTICIPATION_MAX_CONCURRENT_EXPERIMENTS'),
          cooldownAfterTotal: config.get('SUBJECT_PARTICIPATION_COOLDOWN_AFTER_TOTAL'),
          rollingWindowMs: config.get('SUBJECT_PARTICIPATION_ROLLING_WINDOW_MS'),
          cooldownPeriodMs: config.get('SUBJECT_PARTICIPATION_COOLDOWN_PERIOD_MS'),
        }),
      inject: [TypedConfigService],
    },
    {
      provide: DecideService,
      useFactory: () => new DecideService(new TargetingRuleParser(), new TargetingRuleEvaluator()),
    },
    ExperimentAssignmentService,
    FlagResolver,
    DecisionKafkaLogRepository,
    { provide: DecisionTokenSigner, useExisting: CryptoService },
    { provide: DecisionAnalyticsRepository, useExisting: DecisionKafkaLogRepository },
  ],
  exports: [DecisionAnalyticsRepository, DecideUseCase],
})
export class DecisionModule {}
