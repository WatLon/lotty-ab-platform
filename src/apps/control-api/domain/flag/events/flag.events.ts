import { DomainEvent, DomainEventProps } from '@/shared/domain/common';
import { FlagValueType } from '../flag-value-type.enum';

export type FlagCreatedPayload = {
  key: string;
  valueType: FlagValueType;
  defaultValue: string;
  description: string | null;
};

export class FlagCreated extends DomainEvent {
  readonly aggregateType = 'Flag';

  readonly eventName = 'FlagCreated';

  constructor(
    props: DomainEventProps,
    public readonly payload: FlagCreatedPayload,
  ) {
    super(props);
  }
}

export type FlagDefaultValueChangedPayload = {
  defaultValue: string;
};

export class FlagDefaultValueChanged extends DomainEvent {
  readonly aggregateType = 'Flag';

  readonly eventName = 'FlagDefaultValueChanged';

  constructor(
    props: DomainEventProps,
    public readonly payload: FlagDefaultValueChangedPayload,
  ) {
    super(props);
  }
}

export type FlagDescriptionChangedPayload = {
  description: string | null;
};

export class FlagDescriptionChanged extends DomainEvent {
  readonly aggregateType = 'Flag';

  readonly eventName = 'FlagDescriptionChanged';

  constructor(
    props: DomainEventProps,
    public readonly payload: FlagDescriptionChangedPayload,
  ) {
    super(props);
  }
}
