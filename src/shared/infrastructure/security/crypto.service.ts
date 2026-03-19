import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  DecisionTokenPayload,
  DecisionTokenSigner,
  DecisionTokenSignInput,
} from '@/contracts/decision-token';
import { TypedConfigService } from '@/shared/infrastructure/config';

const DECISION_TOKEN_HEADER = {
  alg: 'HS256',
  typ: 'JWT',
} as const;

@Injectable()
export class CryptoService extends DecisionTokenSigner {
  private readonly secret: Buffer;

  private readonly ttlSeconds: number;

  constructor(private readonly config: TypedConfigService) {
    super();

    const appSecret = this.config.get('APP_SECRET');
    this.ttlSeconds = this.config.get('DECISION_TOKEN_TTL_SECONDS');
    this.secret = createHmac('sha256', Buffer.from(appSecret, 'utf8'))
      .update('decision-token-v1')
      .digest();
  }

  signDecisionToken(payload: DecisionTokenSignInput): string {
    const iat = Math.floor(Date.now() / 1000);
    const tokenPayload: DecisionTokenPayload = {
      ...payload,
      iat,
      exp: iat + this.ttlSeconds,
    };
    const header = this.encodeBase64Url(JSON.stringify(DECISION_TOKEN_HEADER));
    const body = this.encodeBase64Url(JSON.stringify(tokenPayload));
    const signingInput = `${header}.${body}`;
    const signature = this.sign(signingInput);
    return `${signingInput}.${signature}`;
  }

  verifyDecisionToken(token: string): DecisionTokenPayload | null {
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

      if (parsedHeader.alg !== DECISION_TOKEN_HEADER.alg) return null;

      if (parsedHeader.typ !== DECISION_TOKEN_HEADER.typ) return null;

      const payload = JSON.parse(
        this.decodeBase64Url(encodedPayload).toString('utf8'),
      ) as Partial<DecisionTokenPayload>;

      if (
        typeof payload.e !== 'string' ||
        typeof payload.v !== 'string' ||
        typeof payload.u !== 'string' ||
        typeof payload.iat !== 'number' ||
        typeof payload.exp !== 'number'
      ) {
        return null;
      }

      const now = Math.floor(Date.now() / 1000);
      if (payload.exp <= now) {
        return null;
      }

      return {
        e: payload.e,
        v: payload.v,
        u: payload.u,
        iat: payload.iat,
        exp: payload.exp,
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
