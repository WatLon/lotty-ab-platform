import { Metric as PrismaMetric } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import {
  Metric,
  MetricFormula,
  MetricFormulaPayloadInvalidError,
  MetricId,
  MetricKey,
  MetricName,
} from '@/apps/control-api/domain/metric';
import { PersistenceMapper } from '@/shared/infrastructure/persistence';

@Injectable()
export class MetricMapper implements PersistenceMapper<Metric, PrismaMetric> {
  toDomain(raw: PrismaMetric): Metric {
    const formulaResult = MetricFormula.create(raw.formula);
    if (formulaResult.isErr()) {
      throw new MetricFormulaPayloadInvalidError(raw.id, formulaResult.error.message);
    }

    return Metric.reconstitute(
      {
        key: MetricKey.reconstitute(raw.key),
        name: MetricName.reconstitute(raw.name),
        description: raw.description,
        formula: formulaResult.value,
        isArchived: raw.isArchived,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      },
      MetricId.from(raw.id),
    );
  }
}
