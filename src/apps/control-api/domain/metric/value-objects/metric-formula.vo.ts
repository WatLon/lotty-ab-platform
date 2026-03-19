import { err, isPlainObject, ok, Result, ValueObject } from '@/shared/domain/common';
import { InvalidFormatError } from '@/shared/domain/common/errors';
import { MetricAggregation } from '../metric-aggregation.enum';

export interface CountFormula {
  type: MetricAggregation.COUNT;
  eventTypeKey: string;
}

export interface RatioFormula {
  type: MetricAggregation.RATIO;
  numeratorEventTypeKey: string;
  denominatorEventTypeKey: string;
}

export interface AverageFormula {
  type: MetricAggregation.AVERAGE;
  eventTypeKey: string;
  payloadField: string;
}

export interface PercentileFormula {
  type: MetricAggregation.PERCENTILE;
  eventTypeKey: string;
  payloadField: string;
  percentileValue: number;
}

export type MetricFormulaData = CountFormula | RatioFormula | AverageFormula | PercentileFormula;

interface MetricFormulaProps {
  data: MetricFormulaData;
}

export class MetricFormula extends ValueObject<MetricFormulaProps> {
  private constructor(props: MetricFormulaProps) {
    super(props);
  }

  static create(input: unknown): Result<MetricFormula, InvalidFormatError> {
    if (!isPlainObject(input)) {
      return err(new InvalidFormatError('formula', 'valid metric formula object'));
    }

    const type = input.type;

    switch (type) {
      case MetricAggregation.COUNT:
        return MetricFormula.parseCount(input);

      case MetricAggregation.RATIO:
        return MetricFormula.parseRatio(input);

      case MetricAggregation.AVERAGE:
        return MetricFormula.parseAverage(input);

      case MetricAggregation.PERCENTILE:
        return MetricFormula.parsePercentile(input);

      default:
        return err(new InvalidFormatError('formula.type', 'COUNT | RATIO | AVERAGE | PERCENTILE'));
    }
  }

  static reconstitute(data: MetricFormulaData): MetricFormula {
    return new MetricFormula({ data });
  }

  private static parseCount(
    obj: Record<string, unknown>,
  ): Result<MetricFormula, InvalidFormatError> {
    if (typeof obj.eventTypeKey !== 'string') {
      return err(new InvalidFormatError('formula.eventTypeKey', 'non-empty string'));
    }
    const eventTypeKey = obj.eventTypeKey.trim();
    if (!eventTypeKey) {
      return err(new InvalidFormatError('formula.eventTypeKey', 'non-empty string'));
    }

    return ok(
      new MetricFormula({
        data: { type: MetricAggregation.COUNT, eventTypeKey },
      }),
    );
  }

  private static parseRatio(
    obj: Record<string, unknown>,
  ): Result<MetricFormula, InvalidFormatError> {
    if (typeof obj.numeratorEventTypeKey !== 'string') {
      return err(new InvalidFormatError('formula.numeratorEventTypeKey', 'non-empty string'));
    }
    const numeratorEventTypeKey = obj.numeratorEventTypeKey.trim();
    if (!numeratorEventTypeKey) {
      return err(new InvalidFormatError('formula.numeratorEventTypeKey', 'non-empty string'));
    }

    if (typeof obj.denominatorEventTypeKey !== 'string') {
      return err(new InvalidFormatError('formula.denominatorEventTypeKey', 'non-empty string'));
    }
    const denominatorEventTypeKey = obj.denominatorEventTypeKey.trim();
    if (!denominatorEventTypeKey) {
      return err(new InvalidFormatError('formula.denominatorEventTypeKey', 'non-empty string'));
    }
    if (numeratorEventTypeKey === denominatorEventTypeKey) {
      return err(
        new InvalidFormatError(
          'formula.denominatorEventTypeKey',
          'must be different from numeratorEventTypeKey',
        ),
      );
    }

    return ok(
      new MetricFormula({
        data: {
          type: MetricAggregation.RATIO,
          numeratorEventTypeKey,
          denominatorEventTypeKey,
        },
      }),
    );
  }

  private static parseAverage(
    obj: Record<string, unknown>,
  ): Result<MetricFormula, InvalidFormatError> {
    if (typeof obj.eventTypeKey !== 'string') {
      return err(new InvalidFormatError('formula.eventTypeKey', 'non-empty string'));
    }
    const eventTypeKey = obj.eventTypeKey.trim();
    if (!eventTypeKey) {
      return err(new InvalidFormatError('formula.eventTypeKey', 'non-empty string'));
    }

    if (typeof obj.payloadField !== 'string') {
      return err(new InvalidFormatError('formula.payloadField', 'non-empty string'));
    }
    const payloadField = obj.payloadField.trim();
    if (!payloadField) {
      return err(new InvalidFormatError('formula.payloadField', 'non-empty string'));
    }

    return ok(
      new MetricFormula({
        data: {
          type: MetricAggregation.AVERAGE,
          eventTypeKey,
          payloadField,
        },
      }),
    );
  }

  private static parsePercentile(
    obj: Record<string, unknown>,
  ): Result<MetricFormula, InvalidFormatError> {
    if (typeof obj.eventTypeKey !== 'string') {
      return err(new InvalidFormatError('formula.eventTypeKey', 'non-empty string'));
    }
    const eventTypeKey = obj.eventTypeKey.trim();
    if (!eventTypeKey) {
      return err(new InvalidFormatError('formula.eventTypeKey', 'non-empty string'));
    }

    if (typeof obj.payloadField !== 'string') {
      return err(new InvalidFormatError('formula.payloadField', 'non-empty string'));
    }
    const payloadField = obj.payloadField.trim();
    if (!payloadField) {
      return err(new InvalidFormatError('formula.payloadField', 'non-empty string'));
    }

    if (
      typeof obj.percentileValue !== 'number' ||
      obj.percentileValue <= 0 ||
      obj.percentileValue > 1
    ) {
      return err(
        new InvalidFormatError(
          'formula.percentileValue',
          'number between 0 (exclusive) and 1 (inclusive)',
        ),
      );
    }

    return ok(
      new MetricFormula({
        data: {
          type: MetricAggregation.PERCENTILE,
          eventTypeKey,
          payloadField,
          percentileValue: obj.percentileValue,
        },
      }),
    );
  }

  get data(): MetricFormulaData {
    return this.props.data;
  }

  get type(): MetricAggregation {
    return this.props.data.type;
  }

  toJSON(): MetricFormulaData {
    return this.props.data;
  }
}
