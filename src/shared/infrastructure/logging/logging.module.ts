import { Global, Module } from '@nestjs/common';
import { AppLogger } from '@/shared/application';
import { PinoLoggerAdapter } from './pino-logger.adapter';

@Global()
@Module({
  providers: [{ provide: AppLogger, useClass: PinoLoggerAdapter }],
  exports: [AppLogger],
})
export class AppLoggingModule {}
