import { Injectable } from '@nestjs/common';
import {
  ExperimentApproved,
  ExperimentArchived,
  ExperimentAudiencePercentChanged,
  ExperimentAudiencePercentChangedPayload,
  ExperimentChangesRequested,
  ExperimentCompleted,
  ExperimentCompletedPayload,
  ExperimentCreated,
  ExperimentCreatedPayload,
  ExperimentDescriptionChanged,
  ExperimentDescriptionChangedPayload,
  ExperimentEvent,
  ExperimentMetricAttached,
  ExperimentMetricAttachedPayload,
  ExperimentMetricDetached,
  ExperimentMetricDetachedPayload,
  ExperimentNameChanged,
  ExperimentNameChangedPayload,
  ExperimentPaused,
  ExperimentPrimaryMetricSet,
  ExperimentPrimaryMetricSetPayload,
  ExperimentRejected,
  ExperimentResumed,
  ExperimentRevised,
  ExperimentStarted,
  ExperimentSubmittedForReview,
  ExperimentTargetingRuleChanged,
  ExperimentTargetingRuleChangedPayload,
  ReviewAdded,
  ReviewAddedPayload,
  VariantAdded,
  VariantAddedPayload,
  VariantRemoved,
  VariantRemovedPayload,
  VariantUpdated,
  VariantUpdatedPayload,
} from '@/apps/control-api/domain/experiment/events';
import { DomainEventProps } from '@/shared/domain/common';

export interface StoredEvent {
  id: string;
  aggregateId: string;
  version: number;
  eventType: string;
  payload: unknown;
  occurredAt: Date;
}

type EventFactory = (props: DomainEventProps, payload: unknown) => ExperimentEvent;

const EXPERIMENT_EVENT_FACTORIES: Record<string, EventFactory> = {
  ExperimentCreated: (props, payload) =>
    new ExperimentCreated(props, payload as ExperimentCreatedPayload),
  ExperimentNameChanged: (props, payload) =>
    new ExperimentNameChanged(props, payload as ExperimentNameChangedPayload),
  ExperimentDescriptionChanged: (props, payload) =>
    new ExperimentDescriptionChanged(props, payload as ExperimentDescriptionChangedPayload),
  ExperimentAudiencePercentChanged: (props, payload) =>
    new ExperimentAudiencePercentChanged(props, payload as ExperimentAudiencePercentChangedPayload),
  ExperimentTargetingRuleChanged: (props, payload) =>
    new ExperimentTargetingRuleChanged(props, payload as ExperimentTargetingRuleChangedPayload),
  VariantAdded: (props, payload) => new VariantAdded(props, payload as VariantAddedPayload),
  VariantUpdated: (props, payload) => new VariantUpdated(props, payload as VariantUpdatedPayload),
  VariantRemoved: (props, payload) => new VariantRemoved(props, payload as VariantRemovedPayload),
  ExperimentMetricAttached: (props, payload) =>
    new ExperimentMetricAttached(props, payload as ExperimentMetricAttachedPayload),
  ExperimentMetricDetached: (props, payload) =>
    new ExperimentMetricDetached(props, payload as ExperimentMetricDetachedPayload),
  ExperimentPrimaryMetricSet: (props, payload) =>
    new ExperimentPrimaryMetricSet(props, payload as ExperimentPrimaryMetricSetPayload),
  ExperimentSubmittedForReview: (props) => new ExperimentSubmittedForReview(props),
  ReviewAdded: (props, payload) => new ReviewAdded(props, payload as ReviewAddedPayload),
  ExperimentApproved: (props) => new ExperimentApproved(props),
  ExperimentRejected: (props) => new ExperimentRejected(props),
  ExperimentChangesRequested: (props) => new ExperimentChangesRequested(props),
  ExperimentRevised: (props) => new ExperimentRevised(props),
  ExperimentStarted: (props) => new ExperimentStarted(props),
  ExperimentPaused: (props) => new ExperimentPaused(props),
  ExperimentResumed: (props) => new ExperimentResumed(props),
  ExperimentCompleted: (props, payload) =>
    new ExperimentCompleted(props, payload as ExperimentCompletedPayload),
  ExperimentArchived: (props) => new ExperimentArchived(props),
};

@Injectable()
export class ExperimentEventSerializer {
  serialize(
    event: ExperimentEvent,
    aggregateId: string,
    version: number,
  ): {
    aggregateId: string;
    version: number;
    eventId: string;
    eventType: string;
    payload: unknown;
    occurredAt: Date;
  } {
    return {
      aggregateId,
      version,
      eventId: event.eventId,
      eventType: event.eventName,
      payload: 'payload' in event ? event.payload : {},
      occurredAt: event.occurredOn,
    };
  }

  deserialize(raw: StoredEvent): ExperimentEvent {
    const props: DomainEventProps = {
      aggregateId: raw.aggregateId,
      eventId: raw.id,
      occurredOn: raw.occurredAt,
    };
    const factory = EXPERIMENT_EVENT_FACTORIES[raw.eventType];
    if (!factory) {
      throw new Error(`Unknown experiment event type: ${raw.eventType}`);
    }
    return factory(props, raw.payload);
  }
}
