import { StringId } from '@/shared/domain/common';

export class FlagId extends StringId {
  protected readonly _brand = 'FlagId';
  static generate(): FlagId {
    return new FlagId(crypto.randomUUID());
  }
  static from(value: string): FlagId {
    return new FlagId(value);
  }
}
