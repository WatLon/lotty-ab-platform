import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { TooHighError, TooLowError } from '@/shared/domain/common/errors';

interface RequiredApprovalsProps {
  value: number;
}

export class RequiredApprovals extends ValueObject<RequiredApprovalsProps> {
  static readonly MIN_VALUE = 1;
  static readonly MAX_VALUE = 10;
  private constructor(props: RequiredApprovalsProps) {
    super(props);
  }

  static create(value: number): Result<RequiredApprovals, TooLowError | TooHighError> {
    if (value < RequiredApprovals.MIN_VALUE) {
      return err(new TooLowError('requiredApprovals', RequiredApprovals.MIN_VALUE, value));
    }

    if (value > RequiredApprovals.MAX_VALUE) {
      return err(new TooHighError('requiredApprovals', RequiredApprovals.MAX_VALUE, value));
    }

    return ok(new RequiredApprovals({ value }));
  }

  static reconstitute(value: number): RequiredApprovals {
    return new RequiredApprovals({ value });
  }

  get value(): number {
    return this.props.value;
  }
}
