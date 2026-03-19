import { LogEvent } from './log-event';
export abstract class AppLogger {
  abstract info(payload: LogEvent, message?: string): void;
  abstract warn(payload: LogEvent, message?: string): void;
  abstract error(payload: LogEvent, error?: unknown, message?: string): void;
  abstract debug(payload: LogEvent, message?: string): void;
}
