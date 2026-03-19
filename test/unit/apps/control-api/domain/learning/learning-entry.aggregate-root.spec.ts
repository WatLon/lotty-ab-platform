import { describe, expect, it } from 'vitest';
import { ExperimentOutcomeType } from '@/apps/control-api/domain/experiment';
import {
  LearningActionTaken,
  LearningEntry,
  LearningFeatureKey,
  LearningHypothesis,
  LearningSummary,
  LearningTag,
  LearningTitle,
} from '@/apps/control-api/domain/learning';
import { MetricKey } from '@/apps/control-api/domain/metric';
import { UserId } from '@/apps/control-api/domain/user';
import { Result } from '@/shared/domain/common';

function mustOk<T, E>(result: Result<T, E>): T {
  if (result.isErr()) {
    throw new Error('expected Ok result');
  }

  return result.value;
}

describe('LearningEntry', () => {
  it('creates entry from value objects and keeps normalized values', () => {
    const result = LearningEntry.create({
      experimentId: null,
      featureKey: mustOk(LearningFeatureKey.create(' checkout.cta ')),
      team: null,
      title: mustOk(LearningTitle.create('  Checkout copy experiment  ')),
      hypothesis: mustOk(LearningHypothesis.create('  clearer CTA improves conversion  ')),
      primaryMetricKey: mustOk(MetricKey.create(' checkout_conversion ')),
      guardrailMetricKeys: [
        mustOk(MetricKey.create('error_rate')),
        mustOk(MetricKey.create('p95_latency')),
      ],
      result: ExperimentOutcomeType.ROLLOUT_WINNER,
      actionTaken: mustOk(LearningActionTaken.create(' rollout_winner ')),
      summary: mustOk(LearningSummary.create('  Positive lift with no quality regressions  ')),
      notes: null,
      tags: [mustOk(LearningTag.create('checkout')), mustOk(LearningTag.create('copy'))],
      countries: [],
      platforms: [],
      reportUrl: null,
      ticketUrl: null,
      createdById: UserId.from('user-1'),
    });

    const entry = mustOk(result);

    expect(entry.title).toBe('Checkout copy experiment');
    expect(entry.primaryMetricKey).toBe('checkout_conversion');
    expect(entry.featureKey).toBe('checkout.cta');
    expect(entry.guardrailMetricKeys).toEqual(['error_rate', 'p95_latency']);
    expect(entry.tags).toEqual(['checkout', 'copy']);
    expect(entry.result).toBe(ExperimentOutcomeType.ROLLOUT_WINNER);
    expect(entry.isArchived).toBe(false);
  });

  it('validates required fields in dedicated value objects', () => {
    expect(LearningTitle.create(' ').isErr()).toBe(true);
    expect(LearningHypothesis.create(' ').isErr()).toBe(true);
    expect(MetricKey.create(' ').isErr()).toBe(true);
    expect(LearningActionTaken.create(' ').isErr()).toBe(true);
    expect(LearningSummary.create(' ').isErr()).toBe(true);
  });

  it('returns validation error for invalid feature key format', () => {
    expect(LearningFeatureKey.create('Checkout CTA').isErr()).toBe(true);
  });

  it('updates mutable fields and can archive entry', () => {
    const created = LearningEntry.create({
      experimentId: null,
      featureKey: null,
      team: null,
      title: mustOk(LearningTitle.create('Initial')),
      hypothesis: mustOk(LearningHypothesis.create('Initial hypothesis')),
      primaryMetricKey: mustOk(MetricKey.create('ctr')),
      guardrailMetricKeys: [],
      result: null,
      actionTaken: mustOk(LearningActionTaken.create('continue')),
      summary: mustOk(LearningSummary.create('Initial summary')),
      notes: null,
      tags: [],
      countries: [],
      platforms: [],
      reportUrl: null,
      ticketUrl: null,
      createdById: UserId.from('author'),
    });

    const entry = mustOk(created);

    entry.changeSummary(mustOk(LearningSummary.create('Updated summary')));
    entry.changeResult(ExperimentOutcomeType.NO_EFFECT);
    entry.replaceTags([mustOk(LearningTag.create('ui')), mustOk(LearningTag.create('checkout'))]);
    entry.markUpdatedBy(UserId.from('editor'));

    expect(entry.summary).toBe('Updated summary');
    expect(entry.result).toBe(ExperimentOutcomeType.NO_EFFECT);
    expect(entry.tags).toEqual(['ui', 'checkout']);
    expect(entry.updatedById).toBe('editor');

    entry.archive(UserId.from('editor'));
    expect(entry.isArchived).toBe(true);
    expect(entry.updatedById).toBe('editor');
  });
});
