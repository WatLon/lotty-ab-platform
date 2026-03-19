import { StringId } from '@/shared/domain/common';

export class ExperimentId extends StringId {
  protected readonly _brand = 'ExperimentId';
  static generate(): ExperimentId {
    return new ExperimentId(crypto.randomUUID());
  }

  static from(value: string): ExperimentId {
    return new ExperimentId(value);
  }
}
