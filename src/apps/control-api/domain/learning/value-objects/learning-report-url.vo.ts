import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { InvalidFormatError, RequiredError, TooLongError } from '@/shared/domain/common/errors';

interface LearningReportUrlProps {
  value: string;
}

export class LearningReportUrl extends ValueObject<LearningReportUrlProps> {
  static readonly MAX_LENGTH = 2048;
  private constructor(props: LearningReportUrlProps) {
    super(props);
  }

  static create(
    value: string,
  ): Result<LearningReportUrl, RequiredError | TooLongError | InvalidFormatError> {
    const normalized = value.trim();

    if (!normalized) {
      return err(new RequiredError('reportUrl'));
    }

    if (normalized.length > LearningReportUrl.MAX_LENGTH) {
      return err(new TooLongError('reportUrl', LearningReportUrl.MAX_LENGTH, normalized.length));
    }

    if (!LearningReportUrl.isValidUrl(normalized)) {
      return err(new InvalidFormatError('reportUrl', 'absolute URL'));
    }

    return ok(new LearningReportUrl({ value: normalized }));
  }

  static reconstitute(value: string): LearningReportUrl {
    return new LearningReportUrl({ value });
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
