import { StringId } from '@/shared/domain/common';

export class VariantId extends StringId {
  protected readonly _brand = 'VariantId';
  static generate(): VariantId {
    return new VariantId(crypto.randomUUID());
  }

  static from(value: string): VariantId {
    return new VariantId(value);
  }
}
