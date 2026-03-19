import { describe, expect, it } from 'vitest';
import { NonErrorThrowableError, toError } from '@/shared/domain/common';

describe('toError', () => {
  it('returns the same Error instance', () => {
    const input = new TypeError('typed');
    const output = toError(input);

    expect(output).toBe(input);
  });

  it('converts string throwables into Error', () => {
    const output = toError('failure');

    expect(output).toBeInstanceOf(Error);
    expect(output).not.toBeInstanceOf(NonErrorThrowableError);
    expect(output.message).toBe('failure');
  });

  it('wraps non-error throwables into NonErrorThrowableError', () => {
    const payload = { reason: 'boom' };
    const output = toError(payload);

    expect(output).toBeInstanceOf(NonErrorThrowableError);
    expect(output.name).toBe('NonErrorThrowableError');
    expect((output as NonErrorThrowableError).original).toBe(payload);
  });
});
