import { Global, Module } from '@nestjs/common';
import { AppLogger } from '@/shared/application';

const noopLogger: AppLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
} as AppLogger;

@Global()
@Module({
  providers: [{ provide: AppLogger, useValue: noopLogger }],
  exports: [AppLogger],
})
export class NoopLoggingModule {}
