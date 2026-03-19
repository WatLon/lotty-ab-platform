import { StringId } from '@/shared/domain/common';

export class EventTypeId extends StringId {
  protected readonly _brand = 'EventTypeId';
  static generate(): EventTypeId {
    return new EventTypeId(crypto.randomUUID());
  }
  static from(value: string): EventTypeId {
    return new EventTypeId(value);
  }
}
