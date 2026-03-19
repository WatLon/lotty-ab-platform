import { BusinessRuleError } from '@/shared/domain/common';
import { EventRecordErrorCode } from './codes';
import { IngestErrorWithPayloadMetadata } from './ingest-error-metadata';

export class InvalidEventPayloadError extends BusinessRuleError {
  readonly code = EventRecordErrorCode.INVALID_EVENT_PAYLOAD;

  public readonly metadata: IngestErrorWithPayloadMetadata;

  constructor(metadata: IngestErrorWithPayloadMetadata) {
    super(`Invalid event payload: ${metadata.schemaError}`);
    this.metadata = metadata;
  }
  toPlain() {
    return { ...super.toPlain(), metadata: this.metadata };
  }
}
