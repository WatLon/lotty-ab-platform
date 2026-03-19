import { Module } from '@nestjs/common';
import {
  ArchiveMetricUseCase,
  CreateMetricUseCase,
  GetMetricUseCase,
  ListMetricsUseCase,
  MetricReadRepository,
  UpdateMetricUseCase,
} from '@/apps/control-api/application/metric';
import { MetricRepository } from '@/apps/control-api/domain/metric';
import { MetricController } from '@/apps/control-api/presentation/metric';
import { UserModule } from '../user/user.module';
import { MetricMapper } from './persistence/metric.mapper';
import { MetricPrismaRepository } from './persistence/metric.prisma-repository';
import { MetricReadPrismaRepository } from './persistence/metric.read-prisma-repository';

@Module({
  imports: [UserModule],
  controllers: [MetricController],
  providers: [
    CreateMetricUseCase,
    UpdateMetricUseCase,
    ArchiveMetricUseCase,
    GetMetricUseCase,
    ListMetricsUseCase,
    MetricMapper,
    { provide: MetricRepository, useClass: MetricPrismaRepository },
    { provide: MetricReadRepository, useClass: MetricReadPrismaRepository },
  ],
  exports: [MetricRepository, MetricReadRepository],
})
export class MetricModule {}
