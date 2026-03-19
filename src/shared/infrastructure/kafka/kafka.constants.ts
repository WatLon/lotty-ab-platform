export const KAFKA_TOPICS = {
  CONTROL_DOMAIN_EVENTS: 'control.domain-events',
  DECISION_LOGS: 'decision.logs',
  EVENTS_RAW: 'events.raw',
  EVENTS_NORMALIZED: 'events.normalized',
  EVENTS_ATTRIBUTED: 'events.attributed',
  METRIC_OBSERVATIONS: 'metric.observations',
} as const;

export const KAFKA_HEADERS = {
  EVENT_TYPE: 'event_type',
} as const;
