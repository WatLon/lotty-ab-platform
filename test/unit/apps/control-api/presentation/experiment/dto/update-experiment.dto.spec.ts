import { describe, expect, it } from 'vitest';
import { UpdateExperimentSchema } from '@/apps/control-api/presentation/experiment/dto/update-experiment.dto';

const METRIC_A = '123e4567-e89b-12d3-a456-426614174000';

const METRIC_B = '123e4567-e89b-12d3-a456-426614174001';

describe('UpdateExperimentSchema', () => {
  it('accepts empty payload and valid updates', () => {
    expect(UpdateExperimentSchema.parse({})).toEqual({});

    expect(
      UpdateExperimentSchema.parse({
        name: 'Updated experiment',
        description: 'new description',
        audiencePercent: 55,
        targetingRule: {
          and: [{ attribute: 'country', op: 'in', value: ['RU', 'KZ'] }],
        },
      }),
    ).toBeDefined();

    expect(
      UpdateExperimentSchema.parse({
        metricIds: [METRIC_A, METRIC_B],
        primaryMetricId: METRIC_A,
      }),
    ).toBeDefined();

    expect(
      UpdateExperimentSchema.parse({
        metricIds: [METRIC_A],
        primaryMetricId: null,
      }),
    ).toBeDefined();
  });

  it('rejects invalid targeting rule payload', () => {
    const result = UpdateExperimentSchema.safeParse({
      targetingRule: {
        bad: true,
      },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.join('.') === 'targetingRule')).toBe(
        true,
      );
    }
  });

  it('rejects duplicate metric IDs', () => {
    const result = UpdateExperimentSchema.safeParse({
      metricIds: [METRIC_A, METRIC_A],
      primaryMetricId: METRIC_A,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) => issue.message.includes('metricIds must be unique')),
      ).toBe(true);
    }
  });

  it('rejects missing primary metric when metricIds are provided', () => {
    const result = UpdateExperimentSchema.safeParse({
      metricIds: [METRIC_A],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.message.includes('primaryMetricId is required when metricIds are provided'),
        ),
      ).toBe(true);
    }
  });

  it('rejects primary metric that is not in metricIds', () => {
    const result = UpdateExperimentSchema.safeParse({
      metricIds: [METRIC_A],
      primaryMetricId: METRIC_B,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some((issue) =>
          issue.message.includes('primaryMetricId must be one of metricIds'),
        ),
      ).toBe(true);
    }
  });
});
