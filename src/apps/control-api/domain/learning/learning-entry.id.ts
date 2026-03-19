import { StringId } from '@/shared/domain/common';

export class LearningEntryId extends StringId {
  protected readonly _brand = 'LearningEntryId';
  static generate(): LearningEntryId {
    return new LearningEntryId(crypto.randomUUID());
  }

  static from(value: string): LearningEntryId {
    return new LearningEntryId(value);
  }
}
