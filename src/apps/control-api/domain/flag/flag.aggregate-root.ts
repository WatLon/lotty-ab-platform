import { AggregateRoot, ok, Result } from '@/shared/domain/common';
import { FlagCreated, FlagDefaultValueChanged, FlagDescriptionChanged } from './events';
import { FlagId } from './flag.id';
import { FlagValueType } from './flag-value-type.enum';
import { FlagDefaultValue } from './value-objects/flag-default-value.vo';
import { FlagKey } from './value-objects/flag-key.vo';

export interface FlagProps {
  key: FlagKey;
  valueType: FlagValueType;
  defaultValue: FlagDefaultValue;
  description: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface CreateFlagProps {
  key: FlagKey;
  valueType: FlagValueType;
  defaultValue: FlagDefaultValue;
  description: string | null;
}

export class Flag extends AggregateRoot<FlagProps, FlagId> {
  private constructor(props: FlagProps, id: FlagId) {
    super(props, id);
  }

  static create(props: CreateFlagProps): Result<Flag, never> {
    const flag = new Flag(
      {
        ...props,
        createdAt: new Date(),
        updatedAt: null,
      },
      FlagId.generate(),
    );

    flag.addDomainEvent(
      new FlagCreated(
        { aggregateId: flag.id.value },
        {
          key: flag.key.value,
          valueType: flag.valueType,
          defaultValue: flag.defaultValue.value,
          description: flag.description,
        },
      ),
    );

    return ok(flag);
  }

  static reconstitute(props: FlagProps, id: FlagId): Flag {
    return new Flag(props, id);
  }

  get key(): FlagKey {
    return this.props.key;
  }

  get valueType(): FlagValueType {
    return this.props.valueType;
  }

  get defaultValue(): FlagDefaultValue {
    return this.props.defaultValue;
  }

  get description(): string | null {
    return this.props.description;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date | null {
    return this.props.updatedAt;
  }

  changeDefaultValue(defaultValue: FlagDefaultValue): void {
    if (defaultValue.equals(this.props.defaultValue)) return;

    this.props.defaultValue = defaultValue;
    this.props.updatedAt = new Date();
    this.addDomainEvent(
      new FlagDefaultValueChanged(
        { aggregateId: this.id.value },
        {
          defaultValue: defaultValue.value,
        },
      ),
    );
  }

  changeDescription(description: string | null): void {
    if (description === this.props.description) return;

    this.props.description = description;
    this.props.updatedAt = new Date();
    this.addDomainEvent(
      new FlagDescriptionChanged(
        { aggregateId: this.id.value },
        {
          description,
        },
      ),
    );
  }
}
