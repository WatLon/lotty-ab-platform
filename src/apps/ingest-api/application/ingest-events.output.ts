import { IngestErrorMetadataBase } from '@/apps/ingest-api/domain';
import { DomainError } from '@/shared/domain/common';

interface IngestErrorMetadata extends IngestErrorMetadataBase {
  eventTypeKey?: string;
  schemaError?: string;
  maxBatchSize?: number;
  batchSize?: number;
}
export type IngestDomainError = DomainError & {
  metadata: IngestErrorMetadata;
};

export interface IngestEventsOutput {
  accepted: number;
  duplicates: number;
  rejected: number;
  errors: IngestDomainError[];
}
