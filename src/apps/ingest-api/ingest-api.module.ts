import { Module } from '@nestjs/common';
import { IngestModule } from '@/apps/ingest-api/infrastructure';
import { IngestHealthController } from '@/apps/ingest-api/presentation';
import { buildHttpAppImports, HTTP_APP_PROVIDERS } from '@/bootstrap/http-app.module-config';

@Module({
  imports: [...buildHttpAppImports('ingest-api'), IngestModule],
  controllers: [IngestHealthController],
  providers: [...HTTP_APP_PROVIDERS],
})
export class IngestApiModule {}
