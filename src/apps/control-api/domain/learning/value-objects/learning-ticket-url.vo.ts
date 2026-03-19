import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { InvalidFormatError, RequiredError, TooLongError } from '@/shared/domain/common/errors';

interface LearningTicketUrlProps {
  value: string;
}

export class LearningTicketUrl extends ValueObject<LearningTicketUrlProps> {
  static readonly MAX_LENGTH = 2048;
  private constructor(props: LearningTicketUrlProps) {
    super(props);
  }

  static create(
    value: string,
  ): Result<LearningTicketUrl, RequiredError | TooLongError | InvalidFormatError> {
    const normalized = value.trim();

    if (!normalized) {
      return err(new RequiredError('ticketUrl'));
    }

    if (normalized.length > LearningTicketUrl.MAX_LENGTH) {
      return err(new TooLongError('ticketUrl', LearningTicketUrl.MAX_LENGTH, normalized.length));
    }

    if (!LearningTicketUrl.isValidUrl(normalized)) {
      return err(new InvalidFormatError('ticketUrl', 'absolute URL'));
    }

    return ok(new LearningTicketUrl({ value: normalized }));
  }

  static reconstitute(value: string): LearningTicketUrl {
    return new LearningTicketUrl({ value });
  }

  get value(): string {
    return this.props.value;
  }

  private static isValidUrl(value: string): boolean {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
}
