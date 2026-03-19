import { err, ok, Result, ValueObject } from '@/shared/domain/common';
import { RequiredError, TooLongError } from '@/shared/domain/common/errors';

interface LearningNoteProps {
  value: string;
}

export class LearningNote extends ValueObject<LearningNoteProps> {
  static readonly MAX_LENGTH = 4000;
  private constructor(props: LearningNoteProps) {
    super(props);
  }

  static create(value: string): Result<LearningNote, RequiredError | TooLongError> {
    const normalized = value.trim();

    if (!normalized) {
      return err(new RequiredError('notes'));
    }

    if (normalized.length > LearningNote.MAX_LENGTH) {
      return err(new TooLongError('notes', LearningNote.MAX_LENGTH, normalized.length));
    }

    return ok(new LearningNote({ value: normalized }));
  }

  static reconstitute(value: string): LearningNote {
    return new LearningNote({ value });
  }

  get value(): string {
    return this.props.value;
  }
}
