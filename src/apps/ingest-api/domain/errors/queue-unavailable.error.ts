import { DomainError } from '@/shared/domain/common';
import { EventRecordErrorCode } from './codes';
import { IngestErrorMetadataBase } from './ingest-error-metadata';

export class QueueUnavailableError extends DomainError {
  readonly code = EventRecordErrorCode.QUEUE_UNAVAILABLE;

  public readonly metadata: IngestErrorMetadataBase;

  constructor(metadata: IngestErrorMetadataBase) {
    super('Event queue is unavailable');
    this.metadata = metadata;
  }
  toPlain() {
    return { ...super.toPlain(), metadata: this.metadata };
  }
}
