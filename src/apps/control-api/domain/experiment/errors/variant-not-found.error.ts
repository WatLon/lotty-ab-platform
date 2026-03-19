import { BusinessRuleError } from '@/shared/domain/common';
import { VariantId } from '../value-objects/variant.id';
import { ExperimentErrorCode } from './codes';

export interface VariantNotFoundMetadata {
  variantId: string;
}

export class VariantNotFoundError extends BusinessRuleError {
  readonly code = ExperimentErrorCode.VARIANT_NOT_FOUND;

  public readonly metadata: VariantNotFoundMetadata;

  constructor(variantId: VariantId) {
    super(`Variant "${variantId.value}" not found`);
    this.metadata = { variantId: variantId.value };
  }

  toPlain() {
    return {
      ...super.toPlain(),
      metadata: this.metadata,
    };
  }
}
