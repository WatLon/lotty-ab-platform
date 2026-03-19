import { UserPassword } from '@/apps/control-api/domain/user/value-objects/user-password.vo';
import { RequiredError, TooShortError } from '@/shared/domain/common/errors';

describe('UserPassword', () => {
  it('returns required error for empty password', () => {
    const result = UserPassword.validatePlain('');

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(RequiredError);
    }
  });

  it('returns too short error for short password', () => {
    const result = UserPassword.validatePlain('short');

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      expect(result.error).toBeInstanceOf(TooShortError);
    }
  });

  it('accepts valid password length', () => {
    const result = UserPassword.validatePlain('SecurePass123');

    expect(result.isOk()).toBe(true);
  });
});
