import { StringId } from '@/shared/domain/common';

export class ApproverGroupId extends StringId {
  protected readonly _brand = 'ApproverGroupId';
  static generate(): ApproverGroupId {
    return new ApproverGroupId(crypto.randomUUID());
  }
  static from(value: string): ApproverGroupId {
    return new ApproverGroupId(value);
  }
}
