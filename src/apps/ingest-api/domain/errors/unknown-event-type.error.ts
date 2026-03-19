import { BusinessRuleError } from '@/shared/domain/common';
import { EventRecordErrorCode } from './codes';
import { IngestErrorWithEventTypeKeyMetadata } from './ingest-error-metadata';

export class UnknownEventTypeError extends BusinessRuleError {
  readonly code = EventRecordErrorCode.UNKNOWN_EVENT_TYPE;

  public readonly metadata: IngestErrorWithEventTypeKeyMetadata;

  constructor(metadata: IngestErrorWithEventTypeKeyMetadata) {
    super(`Unknown event type "${metadata.eventTypeKey}"`);
    this.metadata = metadata;
  }
  toPlain() {
    return { ...super.toPlain(), metadata: this.metadata };
  }
}
