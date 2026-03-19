import { Buffer } from 'node:buffer';
import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { HmacJwtAuthTokenService } from '@/apps/control-api/infrastructure/auth/hmac-jwt-auth-token.service';
import { EnvConfig } from '@/shared/infrastructure/config/env.validation';
import { TypedConfigService } from '@/shared/infrastructure/config/typed-config.service';

const APP_SECRET = 'auth-secret';

function createConfig(values: {
  APP_SECRET: string;
  AUTH_ACCESS_TOKEN_TTL_SECONDS: number;
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

function signAuthTokenParts(
  appSecret: string,
  encodedHeader: string,
  encodedPayload: string,
): string {
  const secret = createHmac('sha256', Buffer.from(appSecret, 'utf8'))
    .update('auth-token-v1')
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
  const signature = signAuthTokenParts(
    input.appSecret ?? APP_SECRET,
    encodedHeader,
    encodedPayload,
  );
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

describe('HmacJwtAuthTokenService', () => {
  it('issues and verifies token payload', () => {
    const service = new HmacJwtAuthTokenService(
      createConfig({
        APP_SECRET,
        AUTH_ACCESS_TOKEN_TTL_SECONDS: 120,
      }),
    );

    const issued = service.issue('user-1');
    expect(issued.expiresIn).toBe(120);
    const verified = service.verify(issued.token);

    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe('user-1');
    expect(typeof verified?.issuedAt).toBe('number');
    expect(typeof verified?.expiresAt).toBe('number');
    expect(typeof verified?.tokenId).toBe('string');
    expect((verified?.expiresAt ?? 0) > (verified?.issuedAt ?? 0)).toBe(true);
  });

  it('returns null for malformed token and signature mismatches', () => {
    const service = new HmacJwtAuthTokenService(
      createConfig({
        APP_SECRET,
        AUTH_ACCESS_TOKEN_TTL_SECONDS: 120,
      }),
    );

    expect(service.verify('bad-token')).toBeNull();

    const token = service.issue('user-1').token;
    const [header, payload, signature] = token.split('.');

    expect(service.verify(`${header}.${payload}.${signature.slice(0, -1)}`)).toBeNull();
    const tamperedSameLength =
      signature.at(-1) === 'a' ? `${signature.slice(0, -1)}b` : `${signature.slice(0, -1)}a`;
    expect(service.verify(`${header}.${payload}.${tamperedSameLength}`)).toBeNull();
  });

  it('returns null for invalid header, payload shape or expired token', () => {
    const service = new HmacJwtAuthTokenService(
      createConfig({
        APP_SECRET,
        AUTH_ACCESS_TOKEN_TTL_SECONDS: 120,
      }),
    );

    const now = Math.floor(Date.now() / 1000);
    const badAlg = buildSignedToken({
      header: { alg: 'HS512', typ: 'JWT' },
      payload: { sub: 'user-1', iat: now, exp: now + 10, jti: 'jti-1' },
    });
    const badTyp = buildSignedToken({
      header: { alg: 'HS256', typ: 'NOT_JWT' },
      payload: { sub: 'user-1', iat: now, exp: now + 10, jti: 'jti-1' },
    });
    const badPayload = buildSignedToken({
      header: { alg: 'HS256', typ: 'JWT' },
      payload: { sub: 1, iat: now, exp: now + 10, jti: 'jti-1' },
    });
    const expired = buildSignedToken({
      header: { alg: 'HS256', typ: 'JWT' },
      payload: { sub: 'user-1', iat: now - 100, exp: now - 1, jti: 'jti-1' },
    });

    expect(service.verify(badAlg)).toBeNull();
    expect(service.verify(badTyp)).toBeNull();
    expect(service.verify(badPayload)).toBeNull();
    expect(service.verify(expired)).toBeNull();
  });

  it('returns null for signed non-json payload', () => {
    const service = new HmacJwtAuthTokenService(
      createConfig({
        APP_SECRET,
        AUTH_ACCESS_TOKEN_TTL_SECONDS: 120,
      }),
    );

    const header = toBase64Url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' }), 'utf8'));
    const payload = toBase64Url(Buffer.from('not-json', 'utf8'));
    const signature = signAuthTokenParts(APP_SECRET, header, payload);
    expect(service.verify(`${header}.${payload}.${signature}`)).toBeNull();
  });
});
