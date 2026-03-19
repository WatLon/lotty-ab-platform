import { Module } from '@nestjs/common';
import { ExperimentRepository } from '@/apps/control-api/domain/experiment';
import { MetricDataSource } from '@/apps/control-api/domain/metric';
import { ExperimentEventSerializer } from '@/apps/control-api/infrastructure/experiment/persistence/experiment.event-serializer';
import { ExperimentEventStoreRepository } from '@/apps/control-api/infrastructure/experiment/persistence/experiment.event-store-repository';
import { MetricDataClickHouseSource } from '@/apps/control-api/infrastructure/metric/persistence/metric-data.clickhouse-source';
import { GuardrailActionExecutorService } from './guardrail-action-executor.service';
import { GuardrailCheckService } from './guardrail-check.service';
import { GuardrailEvaluatorService } from './guardrail-evaluator.service';
import { GuardrailRuleLoaderService } from './guardrail-rule-loader.service';

@Module({
  providers: [
    GuardrailCheckService,
    GuardrailRuleLoaderService,
    GuardrailEvaluatorService,
    GuardrailActionExecutorService,
    ExperimentEventSerializer,
    MetricDataClickHouseSource,
    { provide: ExperimentRepository, useClass: ExperimentEventStoreRepository },
    { provide: MetricDataSource, useClass: MetricDataClickHouseSource },
  ],
  exports: [GuardrailActionExecutorService],
})
export class GuardrailWorkersModule {}
