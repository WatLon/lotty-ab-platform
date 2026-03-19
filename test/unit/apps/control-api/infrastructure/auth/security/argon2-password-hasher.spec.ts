import { createHash } from 'node:crypto';
import { Argon2PasswordHasher } from '@/apps/control-api/infrastructure/auth/security/argon2-password-hasher';
import { AppLogger } from '@/shared/application';

describe('Argon2PasswordHasher', () => {
  const appLoggerStub = {
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    debug: () => undefined,
  } as unknown as AppLogger;
  const hasher = new Argon2PasswordHasher(appLoggerStub);
  const password = 'SecurePass123';

  it('hashes and verifies argon2 passwords', async () => {
    const hashed = await hasher.hash(password);

    expect(hashed.startsWith('$argon2')).toBe(true);
    await expect(hasher.verify(password, hashed)).resolves.toBe(true);
    expect(hasher.needsRehash(hashed)).toBe(false);
  });

  it('does not verify legacy sha256 hashes', async () => {
    const legacyHash = createHash('sha256').update(password).digest('hex');

    await expect(hasher.verify(password, legacyHash)).resolves.toBe(false);
    expect(hasher.needsRehash(legacyHash)).toBe(false);
  });
});
