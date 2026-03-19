import { AggregateRoot, ok, Result } from '@/shared/domain/common';
import { EventTypeId } from './event-type.id';
import { EventTypeUpdated } from './events';
import { EventTypeDescription } from './value-objects/event-type-description.vo';
import { EventTypeKey } from './value-objects/event-type-key.vo';
import { EventTypeName } from './value-objects/event-type-name.vo';
import { EventTypeSchema } from './value-objects/event-type-schema.vo';

export interface EventTypeProps {
  key: EventTypeKey;
  name: EventTypeName;
  description: EventTypeDescription | null;
  schema: EventTypeSchema;
  requiresExposure: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface CreateEventTypeProps {
  key: EventTypeKey;
  name: EventTypeName;
  description: EventTypeDescription | null;
  schema: EventTypeSchema;
  requiresExposure: boolean;
}

export class EventType extends AggregateRoot<EventTypeProps, EventTypeId> {
  private constructor(props: EventTypeProps, id: EventTypeId) {
    super(props, id);
  }

  static create(props: CreateEventTypeProps): Result<EventType, never> {
    const eventType = new EventType(
      {
        ...props,
        isArchived: false,
        createdAt: new Date(),
        updatedAt: null,
      },
      EventTypeId.generate(),
    );
    eventType.addUpdatedEvent();
    return ok(eventType);
  }

  static reconstitute(props: EventTypeProps, id: EventTypeId): EventType {
    return new EventType(props, id);
  }

  get key(): EventTypeKey {
    return this.props.key;
  }

  get name(): string {
    return this.props.name.value;
  }

  get description(): string | null {
    return this.props.description?.value ?? null;
  }

  get schema(): Record<string, unknown> | null {
    return this.props.schema.value;
  }

  get requiresExposure(): boolean {
    return this.props.requiresExposure;
  }

  get isArchived(): boolean {
    return this.props.isArchived;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date | null {
    return this.props.updatedAt;
  }

  changeName(name: EventTypeName): void {
    if (name.value === this.props.name.value) return;

    this.props.name = name;
    this.props.updatedAt = new Date();
    this.addUpdatedEvent();
  }

  changeDescription(description: EventTypeDescription | null): void {
    if (description?.value === this.props.description?.value) return;

    this.props.description = description;
    this.props.updatedAt = new Date();
    this.addUpdatedEvent();
  }

  changeSchema(schema: EventTypeSchema): void {
    this.props.schema = schema;
    this.props.updatedAt = new Date();
    this.addUpdatedEvent();
  }

  archive(): void {
    if (this.props.isArchived) return;

    this.props.isArchived = true;
    this.props.updatedAt = new Date();
    this.addUpdatedEvent();
  }

  restore(): void {
    if (!this.props.isArchived) return;

    this.props.isArchived = false;
    this.props.updatedAt = new Date();
    this.addUpdatedEvent();
  }

  private addUpdatedEvent(): void {
    this.addDomainEvent(
      new EventTypeUpdated(
        { aggregateId: this.id.value },
        {
          id: this.id.value,
          key: this.key.value,
          schema: this.schema,
          requiresExposure: this.requiresExposure,
          isArchived: this.isArchived,
          createdAt: this.createdAt.toISOString(),
          updatedAt: this.updatedAt?.toISOString() ?? null,
        },
      ),
    );
  }
}
