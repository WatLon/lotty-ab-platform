import { DomainError } from '@/shared/domain/common';
import { EventRecordErrorCode } from './codes';
import { IngestErrorMetadataBase } from './ingest-error-metadata';

interface BatchTooLargeMetadata extends IngestErrorMetadataBase {
  maxBatchSize: number;
  batchSize: number;
}

export class BatchTooLargeError extends DomainError {
  readonly code = EventRecordErrorCode.BATCH_TOO_LARGE;

  public readonly metadata: BatchTooLargeMetadata;

  constructor(metadata: BatchTooLargeMetadata) {
    super(`Batch size ${metadata.batchSize} exceeds maximum allowed ${metadata.maxBatchSize}`);
    this.metadata = metadata;
  }
  toPlain() {
    return { ...super.toPlain(), metadata: this.metadata };
  }
}
