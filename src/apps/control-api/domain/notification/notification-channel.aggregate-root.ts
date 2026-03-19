import { AggregateRoot, ok, Result } from '@/shared/domain/common';
import { NotificationChannelId } from './notification-channel.id';
import { NotificationChannelType } from './notification-channel-type.enum';

export interface NotificationChannelProps {
  name: string;
  type: NotificationChannelType;
  config: unknown;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface CreateNotificationChannelProps {
  name: string;
  type: NotificationChannelType;
  config: unknown;
  isEnabled?: boolean;
}

export class NotificationChannel extends AggregateRoot<
  NotificationChannelProps,
  NotificationChannelId
> {
  private constructor(props: NotificationChannelProps, id: NotificationChannelId) {
    super(props, id);
  }

  static create(props: CreateNotificationChannelProps): Result<NotificationChannel, never> {
    return ok(
      new NotificationChannel(
        {
          name: props.name,
          type: props.type,
          config: props.config,
          isEnabled: props.isEnabled ?? true,
          createdAt: new Date(),
          updatedAt: null,
        },
        NotificationChannelId.generate(),
      ),
    );
  }

  static reconstitute(
    props: NotificationChannelProps,
    id: NotificationChannelId,
  ): NotificationChannel {
    return new NotificationChannel(props, id);
  }

  get name(): string {
    return this.props.name;
  }

  get type(): NotificationChannelType {
    return this.props.type;
  }

  get config(): unknown {
    return this.props.config;
  }

  get isEnabled(): boolean {
    return this.props.isEnabled;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date | null {
    return this.props.updatedAt;
  }

  rename(name: string): void {
    if (name === this.props.name) return;

    this.props.name = name;
    this.props.updatedAt = new Date();
  }

  reconfigure(config: unknown): void {
    this.props.config = config;
    this.props.updatedAt = new Date();
  }

  setEnabled(isEnabled: boolean): void {
    if (this.props.isEnabled === isEnabled) return;

    this.props.isEnabled = isEnabled;
    this.props.updatedAt = new Date();
  }
}
