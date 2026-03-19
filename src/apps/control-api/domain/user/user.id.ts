import { StringId } from '@/shared/domain/common';

export class UserId extends StringId {
  protected readonly _brand = 'UserId';
  static generate(): UserId {
    return new UserId(crypto.randomUUID());
  }
  static from(value: string): UserId {
    return new UserId(value);
  }
}
