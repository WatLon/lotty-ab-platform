import {
  NotificationChannelType as PrismaNotificationChannelType,
  NotificationDeliveryStatus as PrismaNotificationDeliveryStatus,
  NotificationScopeType as PrismaNotificationScopeType,
} from '@generated/prisma/client';
import {
  NotificationChannelType as DomainNotificationChannelType,
  NotificationDeliveryStatus as DomainNotificationDeliveryStatus,
  NotificationScopeType as DomainNotificationScopeType,
} from '@/apps/control-api/domain/notification';
export const DOMAIN_NOTIFICATION_CHANNEL_TYPE_BY_PRISMA_NOTIFICATION_CHANNEL_TYPE: Record<
  PrismaNotificationChannelType,
  DomainNotificationChannelType
> = {
  SLACK: DomainNotificationChannelType.SLACK,
  TELEGRAM: DomainNotificationChannelType.TELEGRAM,
};
export const PRISMA_NOTIFICATION_CHANNEL_TYPE_BY_DOMAIN_NOTIFICATION_CHANNEL_TYPE: Record<
  DomainNotificationChannelType,
  PrismaNotificationChannelType
> = {
  [DomainNotificationChannelType.SLACK]: 'SLACK',
  [DomainNotificationChannelType.TELEGRAM]: 'TELEGRAM',
};
export const DOMAIN_NOTIFICATION_SCOPE_TYPE_BY_PRISMA_NOTIFICATION_SCOPE_TYPE: Record<
  PrismaNotificationScopeType,
  DomainNotificationScopeType
> = {
  ANY: DomainNotificationScopeType.ANY,
  EXPERIMENT: DomainNotificationScopeType.EXPERIMENT,
  FLAG: DomainNotificationScopeType.FLAG,
  OWNER: DomainNotificationScopeType.OWNER,
};
export const PRISMA_NOTIFICATION_SCOPE_TYPE_BY_DOMAIN_NOTIFICATION_SCOPE_TYPE: Record<
  DomainNotificationScopeType,
  PrismaNotificationScopeType
> = {
  [DomainNotificationScopeType.ANY]: 'ANY',
  [DomainNotificationScopeType.EXPERIMENT]: 'EXPERIMENT',
  [DomainNotificationScopeType.FLAG]: 'FLAG',
  [DomainNotificationScopeType.OWNER]: 'OWNER',
};
export const DOMAIN_NOTIFICATION_DELIVERY_STATUS_BY_PRISMA_NOTIFICATION_DELIVERY_STATUS: Record<
  PrismaNotificationDeliveryStatus,
  DomainNotificationDeliveryStatus
> = {
  SENT: DomainNotificationDeliveryStatus.SENT,
  FAILED: DomainNotificationDeliveryStatus.FAILED,
  SUPPRESSED_DEDUP: DomainNotificationDeliveryStatus.SUPPRESSED_DEDUP,
  SUPPRESSED_RATE_LIMIT: DomainNotificationDeliveryStatus.SUPPRESSED_RATE_LIMIT,
};
export const PRISMA_NOTIFICATION_DELIVERY_STATUS_BY_DOMAIN_NOTIFICATION_DELIVERY_STATUS: Record<
  DomainNotificationDeliveryStatus,
  PrismaNotificationDeliveryStatus
> = {
  [DomainNotificationDeliveryStatus.SENT]: 'SENT',
  [DomainNotificationDeliveryStatus.FAILED]: 'FAILED',
  [DomainNotificationDeliveryStatus.SUPPRESSED_DEDUP]: 'SUPPRESSED_DEDUP',
  [DomainNotificationDeliveryStatus.SUPPRESSED_RATE_LIMIT]: 'SUPPRESSED_RATE_LIMIT',
};
