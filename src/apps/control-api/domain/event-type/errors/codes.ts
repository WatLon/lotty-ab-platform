export const EventTypeErrorCode = {
  EVENT_TYPE_KEY_ALREADY_EXISTS: 'EVENT_TYPE_KEY_ALREADY_EXISTS',
  EVENT_TYPE_ARCHIVED: 'EVENT_TYPE_ARCHIVED',
} as const;

export type EventTypeErrorCode = (typeof EventTypeErrorCode)[keyof typeof EventTypeErrorCode];
