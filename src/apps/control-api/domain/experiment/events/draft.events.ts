import { DomainEvent, DomainEventProps } from '@/shared/domain/common';
import { SerializedVariant } from './shared';

export interface ExperimentCreatedPayload {
  name: string;
  description: string | null;
  flagId: string;
  conflictDomain?: string | null;
  priority: number;
  audiencePercent: number;
  targetingRule: unknown;
  ownerId: string;
  variants: SerializedVariant[];
  metricIds: string[];
  primaryMetricId: string | null;
}

export class ExperimentCreated extends DomainEvent {
  readonly aggregateType = 'Experiment';

  readonly eventName = 'ExperimentCreated';

  constructor(
    props: DomainEventProps,
    public readonly payload: ExperimentCreatedPayload,
  ) {
    super(props);
  }
}

export interface ExperimentNameChangedPayload {
  name: string;
}

export class ExperimentNameChanged extends DomainEvent {
  readonly aggregateType = 'Experiment';

  readonly eventName = 'ExperimentNameChanged';

  constructor(
    props: DomainEventProps,
    public readonly payload: ExperimentNameChangedPayload,
  ) {
    super(props);
  }
}

export interface ExperimentDescriptionChangedPayload {
  description: string | null;
}

export class ExperimentDescriptionChanged extends DomainEvent {
  readonly aggregateType = 'Experiment';

  readonly eventName = 'ExperimentDescriptionChanged';

  constructor(
    props: DomainEventProps,
    public readonly payload: ExperimentDescriptionChangedPayload,
  ) {
    super(props);
  }
}

export interface ExperimentAudiencePercentChangedPayload {
  audiencePercent: number;
}

export class ExperimentAudiencePercentChanged extends DomainEvent {
  readonly aggregateType = 'Experiment';

  readonly eventName = 'ExperimentAudiencePercentChanged';

  constructor(
    props: DomainEventProps,
    public readonly payload: ExperimentAudiencePercentChangedPayload,
  ) {
    super(props);
  }
}

export interface ExperimentTargetingRuleChangedPayload {
  targetingRule: unknown;
}

export class ExperimentTargetingRuleChanged extends DomainEvent {
  readonly aggregateType = 'Experiment';

  readonly eventName = 'ExperimentTargetingRuleChanged';

  constructor(
    props: DomainEventProps,
    public readonly payload: ExperimentTargetingRuleChangedPayload,
  ) {
    super(props);
  }
}

export interface VariantAddedPayload {
  variant: SerializedVariant;
}

export class VariantAdded extends DomainEvent {
  readonly aggregateType = 'Experiment';

  readonly eventName = 'VariantAdded';

  constructor(
    props: DomainEventProps,
    public readonly payload: VariantAddedPayload,
  ) {
    super(props);
  }
}

export interface VariantUpdatedPayload {
  variantId: string;
  name?: string;
  value?: string;
  weight?: number;
  isControl?: boolean;
}

export class VariantUpdated extends DomainEvent {
  readonly aggregateType = 'Experiment';

  readonly eventName = 'VariantUpdated';

  constructor(
    props: DomainEventProps,
    public readonly payload: VariantUpdatedPayload,
  ) {
    super(props);
  }
}

export interface VariantRemovedPayload {
  variantId: string;
}

export class VariantRemoved extends DomainEvent {
  readonly aggregateType = 'Experiment';

  readonly eventName = 'VariantRemoved';

  constructor(
    props: DomainEventProps,
    public readonly payload: VariantRemovedPayload,
  ) {
    super(props);
  }
}

export interface ExperimentMetricAttachedPayload {
  metricId: string;
}

export class ExperimentMetricAttached extends DomainEvent {
  readonly aggregateType = 'Experiment';

  readonly eventName = 'ExperimentMetricAttached';

  constructor(
    props: DomainEventProps,
    public readonly payload: ExperimentMetricAttachedPayload,
  ) {
    super(props);
  }
}

export interface ExperimentMetricDetachedPayload {
  metricId: string;
}

export class ExperimentMetricDetached extends DomainEvent {
  readonly aggregateType = 'Experiment';

  readonly eventName = 'ExperimentMetricDetached';

  constructor(
    props: DomainEventProps,
    public readonly payload: ExperimentMetricDetachedPayload,
  ) {
    super(props);
  }
}

export interface ExperimentPrimaryMetricSetPayload {
  metricId: string;
}

export class ExperimentPrimaryMetricSet extends DomainEvent {
  readonly aggregateType = 'Experiment';

  readonly eventName = 'ExperimentPrimaryMetricSet';

  constructor(
    props: DomainEventProps,
    public readonly payload: ExperimentPrimaryMetricSetPayload,
  ) {
    super(props);
  }
}
