import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { RequiredError, TooLongError, TooShortError } from '@/shared/domain/common/errors';

interface UserPasswordProps {
  hashedValue: string;
}

export class UserPassword extends ValueObject<UserPasswordProps> {
  static readonly MIN_LENGTH = 8;
  static readonly MAX_LENGTH = 128;
  private constructor(props: UserPasswordProps) {
    super(props);
  }

  static validatePlain(
    plainPassword: string,
  ): Result<void, RequiredError | TooShortError | TooLongError> {
    if (!plainPassword) {
      return err(new RequiredError('password'));
    }

    if (plainPassword.length < UserPassword.MIN_LENGTH) {
      return err(new TooShortError('password', UserPassword.MIN_LENGTH, plainPassword.length));
    }

    if (plainPassword.length > UserPassword.MAX_LENGTH) {
      return err(new TooLongError('password', UserPassword.MAX_LENGTH, plainPassword.length));
    }

    return ok(undefined);
  }

  static fromHashed(hashedValue: string): UserPassword {
    return new UserPassword({ hashedValue });
  }

  static reconstitute(hashedValue: string): UserPassword {
    return UserPassword.fromHashed(hashedValue);
  }

  get hashedValue(): string {
    return this.props.hashedValue;
  }
}
