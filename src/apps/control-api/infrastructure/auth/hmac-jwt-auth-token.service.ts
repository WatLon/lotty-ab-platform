import { Buffer } from 'node:buffer';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  AuthTokenService,
  IssuedAuthToken,
  VerifiedAuthToken,
} from '@/apps/control-api/application/auth';
import { TypedConfigService } from '@/shared/infrastructure/config';

interface AccessTokenPayload {
  sub: string;
  iat: number;
  exp: number;
  jti: string;
}

const ACCESS_TOKEN_HEADER = {
  alg: 'HS256',
  typ: 'JWT',
} as const;

@Injectable()
export class HmacJwtAuthTokenService implements AuthTokenService {
  private readonly secret: Buffer;
  private readonly expiresInSeconds: number;

  constructor(private readonly config: TypedConfigService) {
    const appSecret = this.config.get('APP_SECRET');
    const ttlSeconds = this.config.get('AUTH_ACCESS_TOKEN_TTL_SECONDS');

    this.secret = createHmac('sha256', Buffer.from(appSecret, 'utf8'))
      .update('auth-token-v1')
      .digest();
    this.expiresInSeconds = ttlSeconds;
  }

  issue(userId: string): IssuedAuthToken {
    const issuedAt = Math.floor(Date.now() / 1000);
    const payload: AccessTokenPayload = {
      sub: userId,
      iat: issuedAt,
      exp: issuedAt + this.expiresInSeconds,
      jti: randomUUID(),
    };

    const header = this.encodeBase64Url(JSON.stringify(ACCESS_TOKEN_HEADER));
    const body = this.encodeBase64Url(JSON.stringify(payload));
    const signingInput = `${header}.${body}`;
    const signature = this.sign(signingInput);

    return {
      token: `${signingInput}.${signature}`,
      expiresIn: this.expiresInSeconds,
    };
  }

  verify(token: string): VerifiedAuthToken | null {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const signingInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = this.sign(signingInput);

    if (!this.safeEqual(encodedSignature, expectedSignature)) {
      return null;
    }

    try {
      const parsedHeader = JSON.parse(this.decodeBase64Url(encodedHeader).toString('utf8')) as {
        alg?: string;
        typ?: string;
      };
      if (
        parsedHeader.alg !== ACCESS_TOKEN_HEADER.alg ||
        parsedHeader.typ !== ACCESS_TOKEN_HEADER.typ
      ) {
        return null;
      }

      const payload = JSON.parse(
        this.decodeBase64Url(encodedPayload).toString('utf8'),
      ) as Partial<AccessTokenPayload>;
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.iat !== 'number' ||
        typeof payload.exp !== 'number' ||
        typeof payload.jti !== 'string'
      ) {
        return null;
      }

      const now = Math.floor(Date.now() / 1000);
      if (payload.exp <= now) {
        return null;
      }

      return {
        userId: payload.sub,
        issuedAt: payload.iat,
        expiresAt: payload.exp,
        tokenId: payload.jti,
      };
    } catch {
      return null;
    }
  }

  private encodeBase64Url(input: string | Buffer): string {
    const base64 = Buffer.isBuffer(input)
      ? input.toString('base64')
      : Buffer.from(input).toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  private decodeBase64Url(input: string): Buffer {
    const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
    const paddingLength = normalized.length % 4;
    const padding = paddingLength === 0 ? '' : '='.repeat(4 - paddingLength);
    return Buffer.from(`${normalized}${padding}`, 'base64');
  }

  private sign(input: string): string {
    const digest = createHmac('sha256', this.secret).update(input).digest();
    return this.encodeBase64Url(digest);
  }

  private safeEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.length !== rightBuffer.length) return false;

    return timingSafeEqual(leftBuffer, rightBuffer);
  }
}
