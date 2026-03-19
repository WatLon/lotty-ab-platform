import { BusinessRuleError } from '@/shared/domain/common';
import { ExperimentErrorCode } from './codes';

export interface VariantsWeightMismatchMetadata {
  totalWeight: number;
  audiencePercent: number;
}

export class VariantsWeightMismatchError extends BusinessRuleError {
  readonly code = ExperimentErrorCode.VARIANTS_WEIGHT_MISMATCH;

  public readonly metadata: VariantsWeightMismatchMetadata;

  constructor(totalWeight: number, audiencePercent: number) {
    super(
      `Sum of variant weights (${totalWeight}) must equal audience percent (${audiencePercent})`,
    );
    this.metadata = { totalWeight, audiencePercent };
  }

  toPlain() {
    return {
      ...super.toPlain(),
      metadata: this.metadata,
    };
  }
}
