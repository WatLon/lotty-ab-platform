import { FlagId } from '@/apps/control-api/domain/flag';
import { MetricId } from '@/apps/control-api/domain/metric';
import { UserId } from '@/apps/control-api/domain/user';
import {
  EventSourcedAggregateRoot,
  err,
  InvalidFormatError,
  NotFoundError,
  ok,
  RequiredError,
  Result,
  ValidationError,
  ValidationErrors,
} from '@/shared/domain/common';
import { Variant } from './entities/variant.entity';
import { ExperimentOutcomeType } from './enums/experiment-outcome-type.enum';
import { ExperimentStatus } from './enums/experiment-status.enum';
import { ReviewDecision } from './enums/review-decision.enum';
import {
  CannotRemoveLastVariantError,
  CompletionCommentRequiredError,
  ExperimentNotEditableError,
  InvalidStatusTransitionError,
  MinimumVariantsRequiredError,
  MultipleControlVariantsError,
  NoControlVariantError,
  OutcomeRequiredForCompletionError,
  VariantNotFoundError,
  VariantsWeightMismatchError,
  WinnerVariantRequiredError,
} from './errors';
import {
  ExperimentApproved,
  ExperimentArchived,
  ExperimentAudiencePercentChanged,
  ExperimentChangesRequested,
  ExperimentCompleted,
  ExperimentCreated,
  ExperimentDescriptionChanged,
  ExperimentEvent,
  ExperimentMetricAttached,
  ExperimentMetricDetached,
  ExperimentNameChanged,
  ExperimentPaused,
  ExperimentPrimaryMetricSet,
  ExperimentRejected,
  ExperimentResumed,
  ExperimentRevised,
  ExperimentStarted,
  ExperimentSubmittedForReview,
  ExperimentTargetingRuleChanged,
  ReviewAdded,
  SerializedVariant,
  VariantAdded,
  VariantRemoved,
  VariantUpdated,
} from './events';
import { AudiencePercent } from './value-objects/audience-percent.vo';
import { ExperimentId } from './value-objects/experiment.id';
import { ExperimentName } from './value-objects/experiment-name.vo';
import { TargetingRule } from './value-objects/targeting-rule.vo';
import { VariantId } from './value-objects/variant.id';
import { VariantName } from './value-objects/variant-name.vo';
import { VariantValue } from './value-objects/variant-value.vo';
import { VariantWeight } from './value-objects/variant-weight.vo';

export interface ExperimentReview {
  id: string;
  reviewerId: string;
  decision: ReviewDecision;
  comment: string | null;
  createdAt: Date;
}

export interface ExperimentOutcome {
  type: ExperimentOutcomeType;
  winnerVariantId: VariantId | null;
  comment: string;
  decidedById: UserId;
  decidedAt: Date;
}

export interface ExperimentProps {
  name: ExperimentName;
  description: string | null;
  flagId: FlagId;
  status: ExperimentStatus;
  conflictDomain: string | null;
  priority: number;
  audiencePercent: AudiencePercent;
  targetingRule: TargetingRule;
  ownerId: UserId;
  variants: Variant[];
  reviews: ExperimentReview[];
  outcome: ExperimentOutcome | null;
  metricIds: string[];
  primaryMetricId: string | null;
  startedAt: Date | null;
  pausedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface CreateExperimentProps {
  name: ExperimentName;
  description: string | null;
  flagId: FlagId;
  conflictDomain: string | null;
  priority: number;
  audiencePercent: AudiencePercent;
  targetingRule: TargetingRule;
  ownerId: UserId;
  variants: Variant[];
  metricIds?: string[];
  primaryMetricId?: string | null;
}

export class Experiment extends EventSourcedAggregateRoot<
  ExperimentProps,
  ExperimentId,
  ExperimentEvent
> {
  private static readonly STATUS_TRANSITIONS: Record<ExperimentStatus, ExperimentStatus[]> = {
    [ExperimentStatus.DRAFT]: [ExperimentStatus.IN_REVIEW],
    [ExperimentStatus.IN_REVIEW]: [
      ExperimentStatus.APPROVED,
      ExperimentStatus.REJECTED,
      ExperimentStatus.DRAFT,
    ],
    [ExperimentStatus.APPROVED]: [ExperimentStatus.RUNNING],
    [ExperimentStatus.REJECTED]: [ExperimentStatus.DRAFT],
    [ExperimentStatus.RUNNING]: [ExperimentStatus.PAUSED, ExperimentStatus.COMPLETED],
    [ExperimentStatus.PAUSED]: [ExperimentStatus.RUNNING, ExperimentStatus.COMPLETED],
    [ExperimentStatus.COMPLETED]: [ExperimentStatus.ARCHIVED],
    [ExperimentStatus.ARCHIVED]: [],
  };

  private constructor(props: ExperimentProps, id: ExperimentId) {
    super(props, id);
  }

  private static createInitialProps(): ExperimentProps {
    return {
      name: ExperimentName.reconstitute(''),
      description: null,
      flagId: FlagId.from('00000000-0000-0000-0000-000000000000'),
      status: ExperimentStatus.DRAFT,
      conflictDomain: null,
      priority: 0,
      audiencePercent: AudiencePercent.reconstitute(1),
      targetingRule: TargetingRule.reconstitute(null),
      ownerId: UserId.from('00000000-0000-0000-0000-000000000000'),
      variants: [],
      reviews: [],
      outcome: null,
      metricIds: [],
      primaryMetricId: null,
      startedAt: null,
      pausedAt: null,
      completedAt: null,
      createdAt: new Date(0),
      updatedAt: null,
    };
  }

  static create(
    props: CreateExperimentProps,
  ): Result<
    Experiment,
    | MinimumVariantsRequiredError
    | NoControlVariantError
    | MultipleControlVariantsError
    | VariantsWeightMismatchError
  > {
    if (props.variants.length < 2) return err(new MinimumVariantsRequiredError());

    const controlCount = props.variants.filter((v) => v.isControl).length;
    if (controlCount === 0) return err(new NoControlVariantError());
    if (controlCount > 1) return err(new MultipleControlVariantsError());

    const totalWeight = props.variants.reduce((sum, v) => sum + v.weight.value, 0);
    if (totalWeight !== props.audiencePercent.value) {
      return err(new VariantsWeightMismatchError(totalWeight, props.audiencePercent.value));
    }

    const metricIds = props.metricIds ?? [];
    const primaryMetricId = props.primaryMetricId ?? null;
    const id = ExperimentId.generate();
    const experiment = new Experiment(Experiment.createInitialProps(), id);
    experiment.raise(
      new ExperimentCreated(
        { aggregateId: id.value },
        {
          name: props.name.value,
          description: props.description,
          flagId: props.flagId.value,
          conflictDomain: props.conflictDomain,
          priority: props.priority,
          audiencePercent: props.audiencePercent.value,
          targetingRule: props.targetingRule.toJSON(),
          ownerId: props.ownerId.value,
          variants: props.variants.map((v) => ({
            id: v.id.value,
            name: v.name.value,
            value: v.value.value,
            weight: v.weight.value,
            isControl: v.isControl,
          })),
          metricIds: [...new Set(metricIds)],
          primaryMetricId,
        },
      ),
    );
    return ok(experiment);
  }

  static reconstitute(id: ExperimentId, events: ExperimentEvent[]): Experiment {
    const experiment = new Experiment(Experiment.createInitialProps(), id);
    experiment.loadFromHistory(events);
    return experiment;
  }

  get name(): ExperimentName {
    return this.props.name;
  }

  get description(): string | null {
    return this.props.description;
  }

  get flagId(): FlagId {
    return this.props.flagId;
  }

  get status(): ExperimentStatus {
    return this.props.status;
  }

  get conflictDomain(): string | null {
    return this.props.conflictDomain;
  }

  get priority(): number {
    return this.props.priority;
  }

  get audiencePercent(): AudiencePercent {
    return this.props.audiencePercent;
  }

  get targetingRule(): TargetingRule {
    return this.props.targetingRule;
  }

  get ownerId(): UserId {
    return this.props.ownerId;
  }

  get variants(): ReadonlyArray<Variant> {
    return this.props.variants;
  }

  get reviews(): ReadonlyArray<ExperimentReview> {
    return this.props.reviews;
  }

  get outcome(): ExperimentOutcome | null {
    return this.props.outcome;
  }

  get metricIds(): ReadonlyArray<string> {
    return this.props.metricIds;
  }

  get primaryMetricId(): string | null {
    return this.props.primaryMetricId;
  }

  get startedAt(): Date | null {
    return this.props.startedAt;
  }

  get pausedAt(): Date | null {
    return this.props.pausedAt;
  }

  get completedAt(): Date | null {
    return this.props.completedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date | null {
    return this.props.updatedAt;
  }

  get isEditable(): boolean {
    return this.props.status === ExperimentStatus.DRAFT;
  }

  get isActive(): boolean {
    return (
      this.props.status === ExperimentStatus.RUNNING ||
      this.props.status === ExperimentStatus.PAUSED
    );
  }

  get controlVariant(): Variant | undefined {
    return this.props.variants.find((v) => v.isControl);
  }

  get approvalCount(): number {
    return this.props.reviews.filter((r) => r.decision === ReviewDecision.APPROVED).length;
  }

  get rejectionCount(): number {
    return this.props.reviews.filter((r) => r.decision === ReviewDecision.REJECTED).length;
  }

  changeName(name: ExperimentName): Result<void, ExperimentNotEditableError> {
    if (!this.isEditable) return err(new ExperimentNotEditableError(this.status));
    if (name.equals(this.props.name)) return ok(undefined);

    this.raise(new ExperimentNameChanged({ aggregateId: this.id.value }, { name: name.value }));
    return ok(undefined);
  }

  changeDescription(description: string | null): Result<void, ExperimentNotEditableError> {
    if (!this.isEditable) return err(new ExperimentNotEditableError(this.status));
    if (description === this.props.description) return ok(undefined);

    this.raise(new ExperimentDescriptionChanged({ aggregateId: this.id.value }, { description }));
    return ok(undefined);
  }

  changeAudiencePercent(
    audiencePercent: AudiencePercent,
  ): Result<void, ExperimentNotEditableError> {
    if (!this.isEditable) return err(new ExperimentNotEditableError(this.status));
    if (audiencePercent.equals(this.props.audiencePercent)) return ok(undefined);

    this.raise(
      new ExperimentAudiencePercentChanged(
        { aggregateId: this.id.value },
        { audiencePercent: audiencePercent.value },
      ),
    );
    return ok(undefined);
  }

  changeTargetingRule(targetingRule: TargetingRule): Result<void, ExperimentNotEditableError> {
    if (!this.isEditable) return err(new ExperimentNotEditableError(this.status));
    if (targetingRule.equals(this.props.targetingRule)) return ok(undefined);

    this.raise(
      new ExperimentTargetingRuleChanged(
        { aggregateId: this.id.value },
        { targetingRule: targetingRule.toJSON() },
      ),
    );
    return ok(undefined);
  }

  addVariant(variant: Variant): Result<void, ExperimentNotEditableError> {
    if (!this.isEditable) return err(new ExperimentNotEditableError(this.status));

    this.raise(
      new VariantAdded(
        { aggregateId: this.id.value },
        {
          variant: {
            id: variant.id.value,
            name: variant.name.value,
            value: variant.value.value,
            weight: variant.weight.value,
            isControl: variant.isControl,
          },
        },
      ),
    );
    return ok(undefined);
  }

  updateVariant(
    variantId: VariantId,
    updates: {
      name?: VariantName;
      value?: VariantValue;
      weight?: VariantWeight;
      isControl?: boolean;
    },
  ): Result<void, ExperimentNotEditableError | VariantNotFoundError> {
    if (!this.isEditable) return err(new ExperimentNotEditableError(this.status));

    const variant = this.props.variants.find((v) => v.id.equals(variantId));
    if (!variant) return err(new VariantNotFoundError(variantId));

    this.raise(
      new VariantUpdated(
        { aggregateId: this.id.value },
        {
          variantId: variantId.value,
          name: updates.name?.value,
          value: updates.value?.value,
          weight: updates.weight?.value,
          isControl: updates.isControl,
        },
      ),
    );
    return ok(undefined);
  }

  removeVariant(
    variantId: VariantId,
  ): Result<
    void,
    ExperimentNotEditableError | VariantNotFoundError | CannotRemoveLastVariantError
  > {
    if (!this.isEditable) return err(new ExperimentNotEditableError(this.status));
    if (this.props.variants.length <= 1) return err(new CannotRemoveLastVariantError());

    const index = this.props.variants.findIndex((v) => v.id.equals(variantId));
    if (index === -1) return err(new VariantNotFoundError(variantId));

    this.raise(new VariantRemoved({ aggregateId: this.id.value }, { variantId: variantId.value }));
    return ok(undefined);
  }

  validateForSubmission(): Result<
    void,
    | MinimumVariantsRequiredError
    | NoControlVariantError
    | MultipleControlVariantsError
    | VariantsWeightMismatchError
  > {
    if (this.props.variants.length < 2) return err(new MinimumVariantsRequiredError());

    const controlCount = this.props.variants.filter((v) => v.isControl).length;
    if (controlCount === 0) return err(new NoControlVariantError());
    if (controlCount > 1) return err(new MultipleControlVariantsError());

    const totalWeight = this.props.variants.reduce((sum, v) => sum + v.weight.value, 0);
    if (totalWeight !== this.props.audiencePercent.value) {
      return err(new VariantsWeightMismatchError(totalWeight, this.props.audiencePercent.value));
    }

    return ok(undefined);
  }

  attachMetric(metricId: string): Result<void, ExperimentNotEditableError> {
    if (!this.isEditable) return err(new ExperimentNotEditableError(this.status));
    if (this.props.metricIds.includes(metricId)) return ok(undefined);

    this.raise(new ExperimentMetricAttached({ aggregateId: this.id.value }, { metricId }));
    return ok(undefined);
  }

  detachMetric(metricId: string): Result<void, ExperimentNotEditableError> {
    if (!this.isEditable) return err(new ExperimentNotEditableError(this.status));

    const index = this.props.metricIds.indexOf(metricId);
    if (index === -1) return ok(undefined);

    this.raise(new ExperimentMetricDetached({ aggregateId: this.id.value }, { metricId }));
    return ok(undefined);
  }

  setPrimaryMetric(metricId: string): Result<void, ExperimentNotEditableError | NotFoundError> {
    if (!this.isEditable) return err(new ExperimentNotEditableError(this.status));

    if (!this.props.metricIds.includes(metricId)) {
      return err(new NotFoundError('metric', MetricId.from(metricId)));
    }
    if (this.props.primaryMetricId === metricId) return ok(undefined);

    this.raise(new ExperimentPrimaryMetricSet({ aggregateId: this.id.value }, { metricId }));
    return ok(undefined);
  }

  private canTransitionTo(targetStatus: ExperimentStatus): boolean {
    return Experiment.STATUS_TRANSITIONS[this.props.status].includes(targetStatus);
  }

  submitForReview(): Result<
    void,
    | InvalidStatusTransitionError
    | MinimumVariantsRequiredError
    | NoControlVariantError
    | MultipleControlVariantsError
    | VariantsWeightMismatchError
    | ValidationErrors
  > {
    if (!this.canTransitionTo(ExperimentStatus.IN_REVIEW)) {
      return err(new InvalidStatusTransitionError(this.status, ExperimentStatus.IN_REVIEW));
    }
    if (this.props.metricIds.length === 0) {
      return err(new ValidationErrors([new RequiredError('metrics')]));
    }
    if (!this.props.primaryMetricId) {
      return err(new ValidationErrors([new RequiredError('primaryMetricId')]));
    }

    if (!this.props.metricIds.includes(this.props.primaryMetricId)) {
      return err(
        new ValidationErrors([
          new InvalidFormatError('primaryMetricId', 'must be one of attached metrics'),
        ]),
      );
    }

    const validation = this.validateForSubmission();
    if (validation.isErr()) return err(validation.error);

    this.raise(new ExperimentSubmittedForReview({ aggregateId: this.id.value }));
    return ok(undefined);
  }

  addReview(input: {
    reviewerId: UserId;
    decision: ReviewDecision;
    comment: string | null;
  }): Result<void, InvalidStatusTransitionError> {
    if (this.props.status !== ExperimentStatus.IN_REVIEW) {
      return err(new InvalidStatusTransitionError(this.status, ExperimentStatus.IN_REVIEW));
    }
    this.raise(
      new ReviewAdded(
        { aggregateId: this.id.value },
        {
          reviewId: crypto.randomUUID(),
          reviewerId: input.reviewerId.value,
          decision: input.decision,
          comment: input.comment,
        },
      ),
    );
    return ok(undefined);
  }

  approve(): Result<void, InvalidStatusTransitionError> {
    if (!this.canTransitionTo(ExperimentStatus.APPROVED)) {
      return err(new InvalidStatusTransitionError(this.status, ExperimentStatus.APPROVED));
    }
    this.raise(new ExperimentApproved({ aggregateId: this.id.value }));
    return ok(undefined);
  }

  reject(): Result<void, InvalidStatusTransitionError> {
    if (!this.canTransitionTo(ExperimentStatus.REJECTED)) {
      return err(new InvalidStatusTransitionError(this.status, ExperimentStatus.REJECTED));
    }
    this.raise(new ExperimentRejected({ aggregateId: this.id.value }));
    return ok(undefined);
  }

  requestChanges(): Result<void, InvalidStatusTransitionError> {
    if (!this.canTransitionTo(ExperimentStatus.DRAFT)) {
      return err(new InvalidStatusTransitionError(this.status, ExperimentStatus.DRAFT));
    }
    this.raise(new ExperimentChangesRequested({ aggregateId: this.id.value }));
    return ok(undefined);
  }

  revise(): Result<void, InvalidStatusTransitionError> {
    if (!this.canTransitionTo(ExperimentStatus.DRAFT)) {
      return err(new InvalidStatusTransitionError(this.status, ExperimentStatus.DRAFT));
    }
    this.raise(new ExperimentRevised({ aggregateId: this.id.value }));
    return ok(undefined);
  }

  start(): Result<void, InvalidStatusTransitionError> {
    if (!this.canTransitionTo(ExperimentStatus.RUNNING)) {
      return err(new InvalidStatusTransitionError(this.status, ExperimentStatus.RUNNING));
    }
    this.raise(new ExperimentStarted({ aggregateId: this.id.value }));
    return ok(undefined);
  }

  pause(): Result<void, InvalidStatusTransitionError> {
    if (!this.canTransitionTo(ExperimentStatus.PAUSED)) {
      return err(new InvalidStatusTransitionError(this.status, ExperimentStatus.PAUSED));
    }
    this.raise(new ExperimentPaused({ aggregateId: this.id.value }));
    return ok(undefined);
  }

  resume(): Result<void, InvalidStatusTransitionError> {
    if (!this.canTransitionTo(ExperimentStatus.RUNNING)) {
      return err(new InvalidStatusTransitionError(this.status, ExperimentStatus.RUNNING));
    }
    this.raise(new ExperimentResumed({ aggregateId: this.id.value }));
    return ok(undefined);
  }

  complete(
    outcome:
      | {
          type: ExperimentOutcomeType;
          winnerVariantId: VariantId | null;
          comment: string;
          decidedById: UserId;
        }
      | null
      | undefined,
  ): Result<
    void,
    | InvalidStatusTransitionError
    | VariantNotFoundError
    | OutcomeRequiredForCompletionError
    | CompletionCommentRequiredError
    | WinnerVariantRequiredError
  > {
    if (!this.canTransitionTo(ExperimentStatus.COMPLETED)) {
      return err(new InvalidStatusTransitionError(this.status, ExperimentStatus.COMPLETED));
    }
    if (!outcome) return err(new OutcomeRequiredForCompletionError());

    if (outcome.comment.trim().length === 0) {
      return err(new CompletionCommentRequiredError());
    }
    if (outcome.type === ExperimentOutcomeType.ROLLOUT_WINNER) {
      if (!outcome.winnerVariantId) return err(new WinnerVariantRequiredError());

      const variant = this.props.variants.find((v) => v.id.equals(outcome.winnerVariantId));
      if (!variant) return err(new VariantNotFoundError(outcome.winnerVariantId));
    }

    this.raise(
      new ExperimentCompleted(
        { aggregateId: this.id.value },
        {
          outcomeType: outcome.type,
          winnerVariantId: outcome.winnerVariantId?.value ?? null,
          comment: outcome.comment,
          decidedById: outcome.decidedById.value,
        },
      ),
    );
    return ok(undefined);
  }

  archive(): Result<void, InvalidStatusTransitionError> {
    if (!this.canTransitionTo(ExperimentStatus.ARCHIVED)) {
      return err(new InvalidStatusTransitionError(this.status, ExperimentStatus.ARCHIVED));
    }
    this.raise(new ExperimentArchived({ aggregateId: this.id.value }));
    return ok(undefined);
  }

  protected apply(event: ExperimentEvent): void {
    this.applyExperimentEvent(event);
  }

  replaceMetrics(
    metricIds: string[],
    primaryMetricId: string | null,
  ): Result<void, ExperimentNotEditableError | ValidationErrors> {
    if (!this.isEditable) return err(new ExperimentNotEditableError(this.status));

    const errors: ValidationError[] = [];

    if (new Set(metricIds).size !== metricIds.length) {
      errors.push(new InvalidFormatError('metricIds', 'unique values'));
    }

    if (metricIds.length > 0 && !primaryMetricId) {
      errors.push(new RequiredError('primaryMetricId'));
    }

    if (metricIds.length === 0 && primaryMetricId) {
      errors.push(new InvalidFormatError('primaryMetricId', 'must be null when metricIds empty'));
    }

    if (primaryMetricId && !metricIds.includes(primaryMetricId)) {
      errors.push(new InvalidFormatError('primaryMetricId', 'must be one of metricIds'));
    }

    if (errors.length > 0) return err(new ValidationErrors(errors));

    for (const existing of [...this.props.metricIds]) {
      if (!metricIds.includes(existing)) {
        this.raise(
          new ExperimentMetricDetached({ aggregateId: this.id.value }, { metricId: existing }),
        );
      }
    }

    for (const metricId of metricIds) {
      if (!this.props.metricIds.includes(metricId)) {
        this.raise(new ExperimentMetricAttached({ aggregateId: this.id.value }, { metricId }));
      }
    }

    if (primaryMetricId && primaryMetricId !== this.props.primaryMetricId) {
      this.raise(
        new ExperimentPrimaryMetricSet(
          { aggregateId: this.id.value },
          { metricId: primaryMetricId },
        ),
      );
    }

    return ok(undefined);
  }

  private applyExperimentEvent(event: ExperimentEvent): void {
    switch (event.eventName) {
      case 'ExperimentCreated':
        this.onExperimentCreated(event);
        return;
      case 'ExperimentNameChanged':
        this.onExperimentNameChanged(event);
        return;
      case 'ExperimentDescriptionChanged':
        this.onExperimentDescriptionChanged(event);
        return;
      case 'ExperimentAudiencePercentChanged':
        this.onExperimentAudiencePercentChanged(event);
        return;
      case 'ExperimentTargetingRuleChanged':
        this.onExperimentTargetingRuleChanged(event);
        return;
      case 'VariantAdded':
        this.onVariantAdded(event);
        return;
      case 'VariantUpdated':
        this.onVariantUpdated(event);
        return;
      case 'VariantRemoved':
        this.onVariantRemoved(event);
        return;
      case 'ExperimentMetricAttached':
        this.onExperimentMetricAttached(event);
        return;
      case 'ExperimentMetricDetached':
        this.onExperimentMetricDetached(event);
        return;
      case 'ExperimentPrimaryMetricSet':
        this.onExperimentPrimaryMetricSet(event);
        return;
      case 'ExperimentSubmittedForReview':
        this.onExperimentSubmittedForReview(event);
        return;
      case 'ReviewAdded':
        this.onReviewAdded(event);
        return;
      case 'ExperimentApproved':
        this.onExperimentApproved(event);
        return;
      case 'ExperimentRejected':
        this.onExperimentRejected(event);
        return;
      case 'ExperimentChangesRequested':
        this.onExperimentChangesRequested(event);
        return;
      case 'ExperimentRevised':
        this.onExperimentRevised(event);
        return;
      case 'ExperimentStarted':
        this.onExperimentStarted(event);
        return;
      case 'ExperimentPaused':
        this.onExperimentPaused(event);
        return;
      case 'ExperimentResumed':
        this.onExperimentResumed(event);
        return;
      case 'ExperimentCompleted':
        this.onExperimentCompleted(event);
        return;
      case 'ExperimentArchived':
        this.onExperimentArchived(event);
        return;
      default: {
        throw new Error('Unknown experiment event');
      }
    }
  }

  private onExperimentCreated(event: ExperimentCreated): void {
    const p = event.payload;
    this.props.name = ExperimentName.reconstitute(p.name);
    this.props.description = p.description;
    this.props.flagId = FlagId.from(p.flagId);
    this.props.status = ExperimentStatus.DRAFT;
    this.props.conflictDomain = p.conflictDomain ?? null;
    this.props.priority = p.priority;
    this.props.audiencePercent = AudiencePercent.reconstitute(p.audiencePercent);
    this.props.targetingRule = TargetingRule.reconstitute(p.targetingRule);
    this.props.ownerId = UserId.from(p.ownerId);
    this.props.variants = p.variants.map((v: SerializedVariant) =>
      Variant.reconstitute(
        {
          name: VariantName.reconstitute(v.name),
          value: VariantValue.reconstitute(v.value),
          weight: VariantWeight.reconstitute(v.weight),
          isControl: v.isControl,
        },
        VariantId.from(v.id),
      ),
    );
    this.props.reviews = [];
    this.props.outcome = null;
    this.props.metricIds = [...new Set(p.metricIds ?? [])];
    this.props.primaryMetricId = p.primaryMetricId ?? null;
    this.props.startedAt = null;
    this.props.pausedAt = null;
    this.props.completedAt = null;
    this.props.createdAt = event.occurredOn;
    this.props.updatedAt = null;
  }

  private onExperimentNameChanged(event: ExperimentNameChanged): void {
    this.props.name = ExperimentName.reconstitute(event.payload.name);
    this.props.updatedAt = event.occurredOn;
  }

  private onExperimentDescriptionChanged(event: ExperimentDescriptionChanged): void {
    this.props.description = event.payload.description;
    this.props.updatedAt = event.occurredOn;
  }

  private onExperimentAudiencePercentChanged(event: ExperimentAudiencePercentChanged): void {
    this.props.audiencePercent = AudiencePercent.reconstitute(event.payload.audiencePercent);
    this.props.updatedAt = event.occurredOn;
  }

  private onExperimentTargetingRuleChanged(event: ExperimentTargetingRuleChanged): void {
    this.props.targetingRule = TargetingRule.reconstitute(event.payload.targetingRule);
    this.props.updatedAt = event.occurredOn;
  }

  private onVariantAdded(event: VariantAdded): void {
    const v = event.payload.variant;
    this.props.variants.push(
      Variant.reconstitute(
        {
          name: VariantName.reconstitute(v.name),
          value: VariantValue.reconstitute(v.value),
          weight: VariantWeight.reconstitute(v.weight),
          isControl: v.isControl,
        },
        VariantId.from(v.id),
      ),
    );
    this.props.updatedAt = event.occurredOn;
  }

  private onVariantUpdated(event: VariantUpdated): void {
    const p = event.payload;
    const variant = this.props.variants.find((v) => v.id.value === p.variantId);
    if (!variant) return;

    if (p.name !== undefined) variant.changeName(VariantName.reconstitute(p.name));
    if (p.value !== undefined) variant.changeValue(VariantValue.reconstitute(p.value));
    if (p.weight !== undefined) variant.changeWeight(VariantWeight.reconstitute(p.weight));
    if (p.isControl !== undefined) variant.setAsControl(p.isControl);
    this.props.updatedAt = event.occurredOn;
  }

  private onVariantRemoved(event: VariantRemoved): void {
    this.props.variants = this.props.variants.filter((v) => v.id.value !== event.payload.variantId);
    this.props.updatedAt = event.occurredOn;
  }

  private onExperimentMetricAttached(event: ExperimentMetricAttached): void {
    if (this.props.metricIds.includes(event.payload.metricId)) return;

    this.props.metricIds.push(event.payload.metricId);
    this.props.updatedAt = event.occurredOn;
  }

  private onExperimentMetricDetached(event: ExperimentMetricDetached): void {
    this.props.metricIds = this.props.metricIds.filter((id) => id !== event.payload.metricId);
    if (this.props.primaryMetricId === event.payload.metricId) {
      this.props.primaryMetricId = null;
    }
    this.props.updatedAt = event.occurredOn;
  }

  private onExperimentPrimaryMetricSet(event: ExperimentPrimaryMetricSet): void {
    if (!this.props.metricIds.includes(event.payload.metricId)) return;

    this.props.primaryMetricId = event.payload.metricId;
    this.props.updatedAt = event.occurredOn;
  }

  private onExperimentSubmittedForReview(event: ExperimentSubmittedForReview): void {
    this.props.status = ExperimentStatus.IN_REVIEW;
    this.props.reviews = [];
    this.props.updatedAt = event.occurredOn;
  }

  private onReviewAdded(event: ReviewAdded): void {
    const p = event.payload;
    this.props.reviews.push({
      id: p.reviewId,
      reviewerId: p.reviewerId,
      decision: p.decision,
      comment: p.comment,
      createdAt: event.occurredOn,
    });
    this.props.updatedAt = event.occurredOn;
  }

  private onExperimentApproved(event: ExperimentApproved): void {
    this.props.status = ExperimentStatus.APPROVED;
    this.props.updatedAt = event.occurredOn;
  }

  private onExperimentRejected(event: ExperimentRejected): void {
    this.props.status = ExperimentStatus.REJECTED;
    this.props.updatedAt = event.occurredOn;
  }

  private onExperimentChangesRequested(event: ExperimentChangesRequested): void {
    this.props.status = ExperimentStatus.DRAFT;
    this.props.updatedAt = event.occurredOn;
  }

  private onExperimentRevised(event: ExperimentRevised): void {
    this.props.status = ExperimentStatus.DRAFT;
    this.props.reviews = [];
    this.props.updatedAt = event.occurredOn;
  }

  private onExperimentStarted(event: ExperimentStarted): void {
    this.props.status = ExperimentStatus.RUNNING;
    this.props.startedAt = event.occurredOn;
    this.props.updatedAt = event.occurredOn;
  }

  private onExperimentPaused(event: ExperimentPaused): void {
    this.props.status = ExperimentStatus.PAUSED;
    this.props.pausedAt = event.occurredOn;
    this.props.updatedAt = event.occurredOn;
  }

  private onExperimentResumed(event: ExperimentResumed): void {
    this.props.status = ExperimentStatus.RUNNING;
    this.props.pausedAt = null;
    this.props.updatedAt = event.occurredOn;
  }

  private onExperimentCompleted(event: ExperimentCompleted): void {
    const p = event.payload;
    this.props.status = ExperimentStatus.COMPLETED;
    this.props.completedAt = event.occurredOn;
    this.props.outcome = {
      type: p.outcomeType,
      winnerVariantId: p.winnerVariantId ? VariantId.from(p.winnerVariantId) : null,
      comment: p.comment,
      decidedById: UserId.from(p.decidedById),
      decidedAt: event.occurredOn,
    };
    this.props.updatedAt = event.occurredOn;
  }

  private onExperimentArchived(event: ExperimentArchived): void {
    this.props.status = ExperimentStatus.ARCHIVED;
    this.props.updatedAt = event.occurredOn;
  }
}
