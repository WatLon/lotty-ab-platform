import { BusinessRuleError } from '@/shared/domain/common';
import { EventRecordErrorCode } from './codes';
import { IngestErrorWithEventTypeKeyMetadata } from './ingest-error-metadata';

export class EventTypeArchivedError extends BusinessRuleError {
  readonly code = EventRecordErrorCode.EVENT_TYPE_ARCHIVED;

  public readonly metadata: IngestErrorWithEventTypeKeyMetadata;

  constructor(metadata: IngestErrorWithEventTypeKeyMetadata) {
    super(`Event type "${metadata.eventTypeKey}" is archived`);
    this.metadata = metadata;
  }
  toPlain() {
    return { ...super.toPlain(), metadata: this.metadata };
  }
}
