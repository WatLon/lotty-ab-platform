export const MetricErrorCode = {
  METRIC_KEY_ALREADY_EXISTS: 'METRIC_KEY_ALREADY_EXISTS',
  METRIC_ARCHIVED: 'METRIC_ARCHIVED',
  METRIC_IN_USE_BY_ACTIVE_GUARDRAILS: 'METRIC_IN_USE_BY_ACTIVE_GUARDRAILS',
} as const;

export type MetricErrorCode = (typeof MetricErrorCode)[keyof typeof MetricErrorCode];
