import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { RequiredError, TooLongError, TooShortError } from '@/shared/domain/common/errors';

interface UserNameProps {
  value: string;
}

export class UserName extends ValueObject<UserNameProps> {
  static readonly MIN_LENGTH = 1;
  static readonly MAX_LENGTH = 100;
  private constructor(props: UserNameProps) {
    super(props);
  }

  static create(value: string): Result<UserName, RequiredError | TooShortError | TooLongError> {
    const trimmed = value.trim();

    if (!trimmed) {
      return err(new RequiredError('name'));
    }

    if (trimmed.length < UserName.MIN_LENGTH) {
      return err(new TooShortError('name', UserName.MIN_LENGTH, trimmed.length));
    }

    if (trimmed.length > UserName.MAX_LENGTH) {
      return err(new TooLongError('name', UserName.MAX_LENGTH, trimmed.length));
    }

    return ok(new UserName({ value: trimmed }));
  }

  static reconstitute(value: string): UserName {
    return new UserName({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
