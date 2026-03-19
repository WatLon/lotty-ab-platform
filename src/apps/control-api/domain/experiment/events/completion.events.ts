import { DomainEvent, DomainEventProps } from '@/shared/domain/common';
import { ExperimentOutcomeType } from '../enums/experiment-outcome-type.enum';

export interface ExperimentCompletedPayload {
  outcomeType: ExperimentOutcomeType;
  winnerVariantId: string | null;
  comment: string;
  decidedById: string;
}

export class ExperimentCompleted extends DomainEvent {
  readonly aggregateType = 'Experiment';

  readonly eventName = 'ExperimentCompleted';

  constructor(
    props: DomainEventProps,
    public readonly payload: ExperimentCompletedPayload,
  ) {
    super(props);
  }
}

export class ExperimentArchived extends DomainEvent {
  readonly aggregateType = 'Experiment';

  readonly eventName = 'ExperimentArchived';
}
