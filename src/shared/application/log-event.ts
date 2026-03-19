export type LogDomain = 'http' | 'application' | 'infrastructure' | 'security' | 'system';
export type LogStatus = 'success' | 'failure';

export interface LogEvent {
  event: string;
  domain: LogDomain;
  operation?: string;
  status?: LogStatus;
  statusCode?: number;
  durationMs?: number;
  meta?: Record<string, unknown>;
}
