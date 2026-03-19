import { ExperimentArchived, ExperimentCompleted } from './completion.events';
import {
  ExperimentAudiencePercentChanged,
  ExperimentCreated,
  ExperimentDescriptionChanged,
  ExperimentMetricAttached,
  ExperimentMetricDetached,
  ExperimentNameChanged,
  ExperimentPrimaryMetricSet,
  ExperimentTargetingRuleChanged,
  VariantAdded,
  VariantRemoved,
  VariantUpdated,
} from './draft.events';
import {
  ExperimentApproved,
  ExperimentChangesRequested,
  ExperimentRejected,
  ExperimentRevised,
  ExperimentSubmittedForReview,
  ReviewAdded,
} from './review.events';
import { ExperimentPaused, ExperimentResumed, ExperimentStarted } from './running.events';

export * from './completion.events';
export * from './draft.events';
export * from './review.events';
export * from './running.events';
export * from './shared';
export type ExperimentEvent =
  | ExperimentCreated
  | ExperimentNameChanged
  | ExperimentDescriptionChanged
  | ExperimentAudiencePercentChanged
  | ExperimentTargetingRuleChanged
  | VariantAdded
  | VariantUpdated
  | VariantRemoved
  | ExperimentMetricAttached
  | ExperimentMetricDetached
  | ExperimentPrimaryMetricSet
  | ExperimentSubmittedForReview
  | ReviewAdded
  | ExperimentApproved
  | ExperimentRejected
  | ExperimentChangesRequested
  | ExperimentRevised
  | ExperimentStarted
  | ExperimentPaused
  | ExperimentResumed
  | ExperimentCompleted
  | ExperimentArchived;
