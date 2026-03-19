export class NonErrorThrowableError extends Error {
  readonly original: unknown;

  constructor(original: unknown) {
    super('Non-error throwable was thrown', { cause: original });
    this.name = 'NonErrorThrowableError';
    this.original = original;
  }
}

export function toError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  return new NonErrorThrowableError(error);
}
