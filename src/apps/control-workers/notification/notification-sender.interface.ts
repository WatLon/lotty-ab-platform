import { NotificationChannelType } from '@generated/prisma/client';
import { isPlainObject } from '@/shared/domain/common';

export interface NotificationSendInput {
  channelConfig: unknown;
  targetAddress: string | null;
  message: string;
}

export interface NotificationSendResult {
  ok: boolean;
  response: unknown;
  errorMessage: string | null;
}

export interface NotificationSender {
  readonly type: NotificationChannelType;
  send(input: NotificationSendInput): Promise<NotificationSendResult>;
}
export function readJsonString(value: unknown, key: string): string | null {
  if (!isPlainObject(value)) return null;

  const raw = value[key];
  return typeof raw === 'string' ? raw : null;
}
