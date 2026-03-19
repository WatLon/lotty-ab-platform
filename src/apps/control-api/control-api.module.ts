import { ExperimentStatus as PrismaExperimentStatus } from '@generated/prisma/client';
import { Module } from '@nestjs/common';
import { GetExperimentReportUseCase } from '@/apps/control-api/application/report';
import { MetricDataSource } from '@/apps/control-api/domain/metric';
import { ApproverGroupModule } from '@/apps/control-api/infrastructure/approver-group';
import { AuthModule } from '@/apps/control-api/infrastructure/auth';
import { EventTypeModule } from '@/apps/control-api/infrastructure/event-type';
import { ExperimentModule } from '@/apps/control-api/infrastructure/experiment';
import { FlagModule } from '@/apps/control-api/infrastructure/flag';
import { GuardrailModule } from '@/apps/control-api/infrastructure/guardrail';
import { LearningModule } from '@/apps/control-api/infrastructure/learning';
import { MetricModule } from '@/apps/control-api/infrastructure/metric/metric.module';
import { MetricDataClickHouseSource } from '@/apps/control-api/infrastructure/metric/persistence/metric-data.clickhouse-source';
import { NotificationModule } from '@/apps/control-api/infrastructure/notification';
import { OutboxModule } from '@/apps/control-api/infrastructure/outbox';
import { UserModule } from '@/apps/control-api/infrastructure/user';
import { ReportController } from '@/apps/control-api/presentation/report/report.controller';
import { buildHttpAppImports, HTTP_APP_PROVIDERS } from '@/bootstrap/http-app.module-config';
import { PrismaService } from '@/shared/infrastructure/persistence';
import { HealthController } from '@/shared/presentation/health';
import { METRIC_LOTTY_ACTIVE_EXPERIMENTS, MetricsService } from '@/shared/presentation/metrics';

const CONTROL_API_METRICS_REGISTRATION = Symbol('CONTROL_API_METRICS_REGISTRATION');

const ACTIVE_EXPERIMENT_STATUSES = [
  PrismaExperimentStatus.RUNNING,
  PrismaExperimentStatus.PAUSED,
] as const;

@Module({
  imports: [
    ...buildHttpAppImports('control-api'),
    AuthModule,
    FlagModule,
    MetricModule,
    UserModule,
    ApproverGroupModule,
    EventTypeModule,
    ExperimentModule,
    GuardrailModule,
    LearningModule,
    NotificationModule,
    OutboxModule,
  ],
  controllers: [HealthController, ReportController],
  providers: [
    ...HTTP_APP_PROVIDERS,
    GetExperimentReportUseCase,
    MetricDataClickHouseSource,
    { provide: MetricDataSource, useClass: MetricDataClickHouseSource },
    {
      provide: CONTROL_API_METRICS_REGISTRATION,
      useFactory: (metrics: MetricsService, prisma: PrismaService) => {
        metrics.registerGaugeSupplier(METRIC_LOTTY_ACTIVE_EXPERIMENTS, async () => {
          return prisma.experiment.count({
            where: {
              status: { in: [...ACTIVE_EXPERIMENT_STATUSES] },
            },
          });
        });
        return true;
      },
      inject: [MetricsService, PrismaService],
    },
  ],
})
export class ControlApiModule {}
