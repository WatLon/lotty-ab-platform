import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { RequiredError, TooLongError } from '@/shared/domain/common/errors';

interface LearningTeamProps {
  value: string;
}

export class LearningTeam extends ValueObject<LearningTeamProps> {
  static readonly MAX_LENGTH = 128;
  private constructor(props: LearningTeamProps) {
    super(props);
  }

  static create(value: string): Result<LearningTeam, RequiredError | TooLongError> {
    const normalized = value.trim();

    if (!normalized) {
      return err(new RequiredError('team'));
    }

    if (normalized.length > LearningTeam.MAX_LENGTH) {
      return err(new TooLongError('team', LearningTeam.MAX_LENGTH, normalized.length));
    }

    return ok(new LearningTeam({ value: normalized }));
  }

  static reconstitute(value: string): LearningTeam {
    return new LearningTeam({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
