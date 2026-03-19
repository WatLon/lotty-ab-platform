export interface DecisionTokenPayload {
  e: string;
  v: string;
  u: string;
  iat: number;
  exp: number;
}

export type DecisionTokenSignInput = Pick<DecisionTokenPayload, 'e' | 'v' | 'u'>;

export abstract class DecisionTokenSigner {
  abstract signDecisionToken(payload: DecisionTokenSignInput): string;

  abstract verifyDecisionToken(token: string): DecisionTokenPayload | null;
}
