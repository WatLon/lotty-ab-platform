import { MetricRollup } from './metric-rollup';
import { MetricFormulaData } from './value-objects/metric-formula.vo';

export class MetricFormulaEvaluator {
  private static readonly PERCENTILE_INDICES: ReadonlyMap<number, number> = new Map([
    [0.5, 0],
    [0.9, 1],
    [0.95, 2],
    [0.99, 3],
  ]);

  static collectMetricKeys(formulas: MetricFormulaData[]): string[] {
    const keys = new Set<string>();

    for (const formula of formulas) {
      switch (formula.type) {
        case 'COUNT':
          keys.add(formula.eventTypeKey);
          break;
        case 'RATIO':
          keys.add(formula.numeratorEventTypeKey);
          keys.add(formula.denominatorEventTypeKey);
          break;
        case 'AVERAGE':
          keys.add(`${formula.eventTypeKey}.${formula.payloadField}`);
          break;
        case 'PERCENTILE':
          keys.add(`${formula.eventTypeKey}.${formula.payloadField}`);
          break;
      }
    }

    return Array.from(keys);
  }

  static evaluate(formula: MetricFormulaData, rollup: MetricRollup): number | null {
    switch (formula.type) {
      case 'COUNT': {
        return rollup.get(formula.eventTypeKey)?.count ?? 0;
      }

      case 'RATIO': {
        const numerator = rollup.get(formula.numeratorEventTypeKey)?.count ?? 0;
        const denominator = rollup.get(formula.denominatorEventTypeKey)?.count ?? 0;
        return denominator > 0 ? numerator / denominator : null;
      }

      case 'AVERAGE': {
        const key = `${formula.eventTypeKey}.${formula.payloadField}`;
        const stats = rollup.get(key);
        if (!stats || stats.count <= 0) return null;

        return stats.sum / stats.count;
      }

      case 'PERCENTILE': {
        const key = `${formula.eventTypeKey}.${formula.payloadField}`;
        const stats = rollup.get(key);
        if (!stats || stats.count <= 0) return null;

        const index = MetricFormulaEvaluator.PERCENTILE_INDICES.get(formula.percentileValue);
        if (index === undefined) return null;

        const value = stats.percentiles[index];
        return Number.isFinite(value) ? value : null;
      }
    }

    return null;
  }
}
