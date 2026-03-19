import { Variant } from '@/apps/control-api/domain/experiment/entities/variant.entity';
import { ExperimentOutcomeType } from '@/apps/control-api/domain/experiment/enums/experiment-outcome-type.enum';
import { ExperimentStatus } from '@/apps/control-api/domain/experiment/enums/experiment-status.enum';
import { ReviewDecision } from '@/apps/control-api/domain/experiment/enums/review-decision.enum';
import {
  OutcomeRequiredForCompletionError,
  WinnerVariantRequiredError,
} from '@/apps/control-api/domain/experiment/errors';
import { Experiment } from '@/apps/control-api/domain/experiment/experiment.aggregate-root';
import {
  AudiencePercent,
  ExperimentName,
  TargetingRule,
  VariantName,
  VariantValue,
  VariantWeight,
} from '@/apps/control-api/domain/experiment/value-objects';
import { FlagId } from '@/apps/control-api/domain/flag/flag.id';
import { UserId } from '@/apps/control-api/domain/user/user.id';
import { Result } from '@/shared/domain/common';

const PRIMARY_METRIC_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function unwrapResult<T, E>(result: Result<T, E>): T {
  if (result.isErr()) {
    throw result.error;
  }
  return result.value;
}

function createVariant(name: string, value: string, weight: number, isControl: boolean): Variant {
  return unwrapResult(
    Variant.create({
      name: VariantName.reconstitute(name),
      value: VariantValue.reconstitute(value),
      weight: VariantWeight.reconstitute(weight),
      isControl,
    }),
  );
}

function createExperiment(name: string, description: string | null): Experiment {
  return unwrapResult(
    Experiment.create({
      name: ExperimentName.reconstitute(name),
      description,
      flagId: FlagId.generate(),
      conflictDomain: null,
      priority: 0,
      audiencePercent: AudiencePercent.reconstitute(100),
      targetingRule: TargetingRule.reconstitute(null),
      ownerId: UserId.generate(),
      variants: [
        createVariant('Control', 'A', 50, true),
        createVariant('Treatment', 'B', 50, false),
      ],
    }),
  );
}

function createValidExperiment(): Experiment {
  const experiment = createExperiment('Checkout CTR', 'Experiment for checkout CTR');

  expect(experiment.attachMetric(PRIMARY_METRIC_ID).isOk()).toBe(true);
  expect(experiment.setPrimaryMetric(PRIMARY_METRIC_ID).isOk()).toBe(true);
  expect(experiment.submitForReview().isOk()).toBe(true);
  expect(experiment.approve().isOk()).toBe(true);
  expect(experiment.start().isOk()).toBe(true);

  return experiment;
}

describe('Experiment (Event Sourced)', () => {
  describe('create', () => {
    it('creates experiment in DRAFT status with events', () => {
      const experiment = createExperiment('Test', null);

      expect(experiment.status).toBe(ExperimentStatus.DRAFT);
      expect(experiment.variants).toHaveLength(2);
      expect(experiment.reviews).toHaveLength(0);
      expect(experiment.outcome).toBeNull();
      expect(experiment.uncommittedEvents).toHaveLength(1);
      expect(experiment.uncommittedEvents[0].eventName).toBe('ExperimentCreated');
    });
  });

  describe('lifecycle transitions', () => {
    it('tracks events through full lifecycle', () => {
      const experiment = createValidExperiment();

      expect(experiment.status).toBe(ExperimentStatus.RUNNING);
      expect(experiment.startedAt).not.toBeNull();

      const events = experiment.uncommittedEvents;
      const eventNames = events.map((e) => e.eventName);

      expect(eventNames).toContain('ExperimentCreated');
      expect(eventNames).toContain('ExperimentSubmittedForReview');
      expect(eventNames).toContain('ExperimentApproved');
      expect(eventNames).toContain('ExperimentStarted');
    });
  });

  describe('review', () => {
    it('records review in aggregate', () => {
      const experiment = createExperiment('Test', null);

      expect(experiment.attachMetric(PRIMARY_METRIC_ID).isOk()).toBe(true);
      expect(experiment.setPrimaryMetric(PRIMARY_METRIC_ID).isOk()).toBe(true);
      experiment.submitForReview();

      const result = experiment.addReview({
        reviewerId: UserId.generate(),
        decision: ReviewDecision.APPROVED,
        comment: 'Looks good',
      });

      expect(result.isOk()).toBe(true);
      expect(experiment.reviews).toHaveLength(1);
      expect(experiment.approvalCount).toBe(1);
    });
  });

  describe('complete', () => {
    it('returns OUTCOME_REQUIRED_FOR_COMPLETION when outcome is missing', () => {
      const experiment = createValidExperiment();
      const result = experiment.complete(null);

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(OutcomeRequiredForCompletionError);
      }
    });

    it('returns WINNER_VARIANT_REQUIRED for ROLLOUT_WINNER without winnerVariantId', () => {
      const experiment = createValidExperiment();
      const result = experiment.complete({
        type: ExperimentOutcomeType.ROLLOUT_WINNER,
        winnerVariantId: null,
        comment: 'Winner rollout',
        decidedById: UserId.generate(),
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(WinnerVariantRequiredError);
      }
    });

    it('completes with ROLLBACK outcome', () => {
      const experiment = createValidExperiment();
      const result = experiment.complete({
        type: ExperimentOutcomeType.ROLLBACK,
        winnerVariantId: null,
        comment: 'Rolling back',
        decidedById: UserId.generate(),
      });

      expect(result.isOk()).toBe(true);
      expect(experiment.status).toBe(ExperimentStatus.COMPLETED);
      expect(experiment.outcome).not.toBeNull();
      expect(experiment.outcome!.type).toBe(ExperimentOutcomeType.ROLLBACK);
    });
  });

  describe('reconstitute', () => {
    it('rebuilds state from uncommitted events', () => {
      const original = createExperiment('Recon Test', 'desc');

      expect(original.attachMetric(PRIMARY_METRIC_ID).isOk()).toBe(true);
      expect(original.setPrimaryMetric(PRIMARY_METRIC_ID).isOk()).toBe(true);
      original.submitForReview();
      original.approve();
      original.start();

      const events = [...original.uncommittedEvents];
      const reconstituted = Experiment.reconstitute(original.id, events);

      expect(reconstituted.id.equals(original.id)).toBe(true);
      expect(reconstituted.name.value).toBe('Recon Test');
      expect(reconstituted.status).toBe(ExperimentStatus.RUNNING);
      expect(reconstituted.variants).toHaveLength(2);
      expect(reconstituted.startedAt).not.toBeNull();
      expect(reconstituted.uncommittedEvents).toHaveLength(0);
    });
  });
});
