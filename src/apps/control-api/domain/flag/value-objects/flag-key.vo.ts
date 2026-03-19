import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import {
  InvalidFormatError,
  RequiredError,
  TooLongError,
  TooShortError,
} from '@/shared/domain/common/errors';

interface FlagKeyProps {
  value: string;
}

export class FlagKey extends ValueObject<FlagKeyProps> {
  static readonly MIN_LENGTH = 1;
  static readonly MAX_LENGTH = 128;
  static readonly FORMAT = /^[a-z][a-z0-9_]*$/;
  private constructor(props: FlagKeyProps) {
    super(props);
  }

  static create(
    value: string,
  ): Result<FlagKey, RequiredError | TooShortError | TooLongError | InvalidFormatError> {
    const trimmed = value.trim();

    if (!trimmed) {
      return err(new RequiredError('flagKey'));
    }

    if (trimmed.length < FlagKey.MIN_LENGTH) {
      return err(new TooShortError('flagKey', FlagKey.MIN_LENGTH, trimmed.length));
    }

    if (trimmed.length > FlagKey.MAX_LENGTH) {
      return err(new TooLongError('flagKey', FlagKey.MAX_LENGTH, trimmed.length));
    }

    if (!FlagKey.FORMAT.test(trimmed)) {
      return err(
        new InvalidFormatError(
          'flagKey',
          'lowercase letters, digits, underscores; must start with letter',
        ),
      );
    }

    return ok(new FlagKey({ value: trimmed }));
  }

  static reconstitute(value: string): FlagKey {
    return new FlagKey({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
