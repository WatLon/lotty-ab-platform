import { BusinessRuleError } from '@/shared/domain/common';
import { EventRecordErrorCode } from './codes';
import { IngestErrorMetadataBase } from './ingest-error-metadata';

export class DecisionSubjectMismatchError extends BusinessRuleError {
  readonly code = EventRecordErrorCode.DECISION_SUBJECT_MISMATCH;

  public readonly metadata: IngestErrorMetadataBase;

  constructor(metadata: IngestErrorMetadataBase) {
    super('decision_id subject mismatch');
    this.metadata = metadata;
  }
  toPlain() {
    return { ...super.toPlain(), metadata: this.metadata };
  }
}
