import { Module } from '@nestjs/common';
import {
  CreateGuardrailRuleUseCase,
  DeleteGuardrailRuleUseCase,
  GetGuardrailRuleUseCase,
  GuardrailAccessService,
  GuardrailRuleReadRepository,
  GuardrailTriggerReadRepository,
  ListGuardrailRulesUseCase,
  ListGuardrailTriggersUseCase,
  UpdateGuardrailRuleUseCase,
} from '@/apps/control-api/application/guardrail';
import { GuardrailRuleRepository } from '@/apps/control-api/domain/guardrail';
import { MetricDataSource } from '@/apps/control-api/domain/metric';
import { ExperimentModule } from '@/apps/control-api/infrastructure/experiment';
import { MetricModule } from '@/apps/control-api/infrastructure/metric/metric.module';
import { MetricDataClickHouseSource } from '@/apps/control-api/infrastructure/metric/persistence/metric-data.clickhouse-source';
import { UserModule } from '@/apps/control-api/infrastructure/user';
import {
  ExperimentGuardrailController,
  ExperimentGuardrailTriggerController,
} from '@/apps/control-api/presentation/experiment';
import { ClickHouseModule } from '@/shared/infrastructure/clickhouse/clickhouse.module';
import { GuardrailWorkersModule } from './guardrails';
import { GuardrailRuleMapper } from './persistence/guardrail-rule.mapper';
import { GuardrailRulePrismaRepository } from './persistence/guardrail-rule.prisma-repository';
import { GuardrailRuleReadPrismaRepository } from './persistence/guardrail-rule.read-prisma-repository';
import { GuardrailTriggerReadPrismaRepository } from './persistence/guardrail-trigger.read-prisma-repository';

@Module({
  imports: [UserModule, MetricModule, ExperimentModule, ClickHouseModule, GuardrailWorkersModule],
  controllers: [ExperimentGuardrailController, ExperimentGuardrailTriggerController],
  providers: [
    CreateGuardrailRuleUseCase,
    UpdateGuardrailRuleUseCase,
    DeleteGuardrailRuleUseCase,
    GetGuardrailRuleUseCase,
    ListGuardrailRulesUseCase,
    ListGuardrailTriggersUseCase,
    GuardrailAccessService,
    GuardrailRuleMapper,
    MetricDataClickHouseSource,
    {
      provide: GuardrailRuleRepository,
      useClass: GuardrailRulePrismaRepository,
    },
    {
      provide: GuardrailRuleReadRepository,
      useClass: GuardrailRuleReadPrismaRepository,
    },
    {
      provide: GuardrailTriggerReadRepository,
      useClass: GuardrailTriggerReadPrismaRepository,
    },
    {
      provide: MetricDataSource,
      useClass: MetricDataClickHouseSource,
    },
  ],
  exports: [GuardrailRuleRepository, GuardrailRuleReadRepository, GuardrailTriggerReadRepository],
})
export class GuardrailModule {}
