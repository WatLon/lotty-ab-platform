import { BusinessRuleError } from '@/shared/domain/common';
import { EventRecordErrorCode } from './codes';
import { IngestErrorMetadataBase } from './ingest-error-metadata';

export class InvalidDecisionIdError extends BusinessRuleError {
  readonly code = EventRecordErrorCode.INVALID_DECISION_ID;

  public readonly metadata: IngestErrorMetadataBase;

  constructor(metadata: IngestErrorMetadataBase) {
    super('Invalid decision_id signature');
    this.metadata = metadata;
  }
  toPlain() {
    return { ...super.toPlain(), metadata: this.metadata };
  }
}
