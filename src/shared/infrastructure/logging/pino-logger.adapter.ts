import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { AppLogger, type LogEvent } from '@/shared/application';

@Injectable()
export class PinoLoggerAdapter extends AppLogger {
  constructor(private readonly pino: PinoLogger) {
    super();
  }

  info(payload: LogEvent, message?: string): void {
    this.pino.info(payload, message);
  }

  warn(payload: LogEvent, message?: string): void {
    this.pino.warn(payload, message);
  }

  error(payload: LogEvent, error?: unknown, message?: string): void {
    if (error) {
      this.pino.error({ ...payload, err: error }, message);
    } else {
      this.pino.error(payload, message);
    }
  }

  debug(payload: LogEvent, message?: string): void {
    this.pino.debug(payload, message);
  }
}
