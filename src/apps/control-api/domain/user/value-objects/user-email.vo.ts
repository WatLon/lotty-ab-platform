import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { InvalidFormatError, RequiredError, TooLongError } from '@/shared/domain/common/errors';

interface UserEmailProps {
  value: string;
}

export class UserEmail extends ValueObject<UserEmailProps> {
  static readonly MAX_LENGTH = 255;
  static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private constructor(props: UserEmailProps) {
    super(props);
  }

  static create(
    value: string,
  ): Result<UserEmail, RequiredError | TooLongError | InvalidFormatError> {
    const trimmed = value.trim().toLowerCase();

    if (!trimmed) {
      return err(new RequiredError('email'));
    }

    if (trimmed.length > UserEmail.MAX_LENGTH) {
      return err(new TooLongError('email', UserEmail.MAX_LENGTH, trimmed.length));
    }

    if (!UserEmail.EMAIL_REGEX.test(trimmed)) {
      return err(new InvalidFormatError('email', 'valid email address'));
    }

    return ok(new UserEmail({ value: trimmed }));
  }

  static reconstitute(value: string): UserEmail {
    return new UserEmail({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
