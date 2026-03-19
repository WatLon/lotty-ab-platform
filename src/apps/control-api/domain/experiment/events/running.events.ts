import { DomainEvent } from '@/shared/domain/common';

export class ExperimentStarted extends DomainEvent {
  readonly aggregateType = 'Experiment';

  readonly eventName = 'ExperimentStarted';
}

export class ExperimentPaused extends DomainEvent {
  readonly aggregateType = 'Experiment';

  readonly eventName = 'ExperimentPaused';
}

export class ExperimentResumed extends DomainEvent {
  readonly aggregateType = 'Experiment';

  readonly eventName = 'ExperimentResumed';
}
