import { DomainError } from '@/shared/domain/common';
import { EventRecordErrorCode } from './codes';
import { IngestErrorMetadataBase } from './ingest-error-metadata';

export class EventTypeCatalogNotReadyError extends DomainError {
  readonly code = EventRecordErrorCode.EVENT_TYPE_CATALOG_NOT_READY;

  public readonly metadata: IngestErrorMetadataBase;

  constructor(metadata: IngestErrorMetadataBase) {
    super('Event type catalog snapshot is not ready');
    this.metadata = metadata;
  }
  toPlain() {
    return { ...super.toPlain(), metadata: this.metadata };
  }
}
