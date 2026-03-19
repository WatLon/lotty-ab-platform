import { StringId } from '@/shared/domain/common';

export class MetricId extends StringId {
  protected readonly _brand = 'MetricId';
  static generate(): MetricId {
    return new MetricId(crypto.randomUUID());
  }
  static from(value: string): MetricId {
    return new MetricId(value);
  }
}
