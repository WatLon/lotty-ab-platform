import { DomainEvent, DomainEventProps } from '@/shared/domain/common';
import { ReviewDecision } from '../enums/review-decision.enum';

export interface ReviewAddedPayload {
  reviewId: string;
  reviewerId: string;
  decision: ReviewDecision;
  comment: string | null;
}

export class ReviewAdded extends DomainEvent {
  readonly aggregateType = 'Experiment';

  readonly eventName = 'ReviewAdded';

  constructor(
    props: DomainEventProps,
    public readonly payload: ReviewAddedPayload,
  ) {
    super(props);
  }
}

export class ExperimentSubmittedForReview extends DomainEvent {
  readonly aggregateType = 'Experiment';

  readonly eventName = 'ExperimentSubmittedForReview';
}

export class ExperimentApproved extends DomainEvent {
  readonly aggregateType = 'Experiment';

  readonly eventName = 'ExperimentApproved';
}

export class ExperimentRejected extends DomainEvent {
  readonly aggregateType = 'Experiment';

  readonly eventName = 'ExperimentRejected';
}

export class ExperimentChangesRequested extends DomainEvent {
  readonly aggregateType = 'Experiment';

  readonly eventName = 'ExperimentChangesRequested';
}

export class ExperimentRevised extends DomainEvent {
  readonly aggregateType = 'Experiment';

  readonly eventName = 'ExperimentRevised';
}
