import { Buffer } from 'node:buffer';
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { EnvConfig } from '@/shared/infrastructure/config/env.validation';
import { TypedConfigService } from '@/shared/infrastructure/config/typed-config.service';
import { CryptoService } from '@/shared/infrastructure/security/crypto.service';

const APP_SECRET = 'very-secret';

function createConfig(values: {
  APP_SECRET: string;
  DECISION_TOKEN_TTL_SECONDS: number;
}): TypedConfigService {
  return {
    get<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
      return values[key as keyof typeof values] as EnvConfig[K];
    },
  } as TypedConfigService;
}

function toBase64Url(buffer: Buffer): string {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function signDecisionTokenParts(
  appSecret: string,
  encodedHeader: string,
  encodedPayload: string,
): string {
  const secret = createHmac('sha256', Buffer.from(appSecret, 'utf8'))
    .update('decision-token-v1')
    .digest();
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const digest = createHmac('sha256', secret).update(signingInput).digest();
  return toBase64Url(digest);
}

function buildSignedToken(input: {
  header: unknown;
  payload: unknown;
  appSecret?: string;
}): string {
  const encodedHeader = toBase64Url(Buffer.from(JSON.stringify(input.header), 'utf8'));
  const encodedPayload = toBase64Url(Buffer.from(JSON.stringify(input.payload), 'utf8'));
  const signature = signDecisionTokenParts(
    input.appSecret ?? APP_SECRET,
    encodedHeader,
    encodedPayload,
  );
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

describe('CryptoService', () => {
  it('signs and verifies decision token payload', () => {
    const service = new CryptoService(
      createConfig({
        APP_SECRET,
        DECISION_TOKEN_TTL_SECONDS: 60,
      }),
    );

    const token = service.signDecisionToken({ e: 'exp-1', v: 'var-1', u: 'subject-1' });
    const verified = service.verifyDecisionToken(token);

    expect(verified).not.toBeNull();
    expect(verified?.e).toBe('exp-1');
    expect(verified?.v).toBe('var-1');
    expect(verified?.u).toBe('subject-1');
    expect(typeof verified?.iat).toBe('number');
    expect(typeof verified?.exp).toBe('number');
    expect((verified?.exp ?? 0) > (verified?.iat ?? 0)).toBe(true);
  });

  it('returns null for malformed tokens and invalid signatures', () => {
    const service = new CryptoService(
      createConfig({
        APP_SECRET,
        DECISION_TOKEN_TTL_SECONDS: 60,
      }),
    );

    expect(service.verifyDecisionToken('bad-token')).toBeNull();

    const valid = service.signDecisionToken({ e: 'exp', v: 'var', u: 'user' });
    const [header, payload, signature] = valid.split('.');
    const shortSignature = signature.slice(0, signature.length - 1);
    expect(service.verifyDecisionToken(`${header}.${payload}.${shortSignature}`)).toBeNull();

    const tamperedSameLength =
      signature.at(-1) === 'a' ? `${signature.slice(0, -1)}b` : `${signature.slice(0, -1)}a`;
    expect(service.verifyDecisionToken(`${header}.${payload}.${tamperedSameLength}`)).toBeNull();
  });

  it('returns null for invalid header or payload shape', () => {
    const service = new CryptoService(
      createConfig({
        APP_SECRET,
        DECISION_TOKEN_TTL_SECONDS: 60,
      }),
    );

    const now = Math.floor(Date.now() / 1000);
    const badAlg = buildSignedToken({
      header: { alg: 'HS512', typ: 'JWT' },
      payload: { e: 'exp', v: 'var', u: 'user', iat: now, exp: now + 10 },
    });
    const badTyp = buildSignedToken({
      header: { alg: 'HS256', typ: 'NOT_JWT' },
      payload: { e: 'exp', v: 'var', u: 'user', iat: now, exp: now + 10 },
    });
    const badPayloadShape = buildSignedToken({
      header: { alg: 'HS256', typ: 'JWT' },
      payload: { e: 1, v: 'var', u: 'user', iat: now, exp: now + 10 },
    });

    expect(service.verifyDecisionToken(badAlg)).toBeNull();
    expect(service.verifyDecisionToken(badTyp)).toBeNull();
    expect(service.verifyDecisionToken(badPayloadShape)).toBeNull();
  });

  it('returns null for expired or non-JSON payload', () => {
    const expiredService = new CryptoService(
      createConfig({
        APP_SECRET,
        DECISION_TOKEN_TTL_SECONDS: -1,
      }),
    );
    const expired = expiredService.signDecisionToken({ e: 'exp', v: 'var', u: 'user' });
    expect(expiredService.verifyDecisionToken(expired)).toBeNull();

    const service = new CryptoService(
      createConfig({
        APP_SECRET,
        DECISION_TOKEN_TTL_SECONDS: 60,
      }),
    );
    const header = toBase64Url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8'));
    const payload = toBase64Url(Buffer.from('not-json', 'utf8'));
    const signature = signDecisionTokenParts(APP_SECRET, header, payload);
    expect(service.verifyDecisionToken(`${header}.${payload}.${signature}`)).toBeNull();
  });
});
