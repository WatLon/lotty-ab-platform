import { StringId } from '@/shared/domain/common';

export class GuardrailRuleId extends StringId {
  protected readonly _brand = 'GuardrailRuleId';
  static generate(): GuardrailRuleId {
    return new GuardrailRuleId(crypto.randomUUID());
  }

  static from(value: string): GuardrailRuleId {
    return new GuardrailRuleId(value);
  }
}
