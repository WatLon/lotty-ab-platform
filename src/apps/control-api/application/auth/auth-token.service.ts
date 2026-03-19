export interface IssuedAuthToken {
  token: string;
  expiresIn: number;
}

export interface VerifiedAuthToken {
  userId: string;
  issuedAt: number;
  expiresAt: number;
  tokenId: string;
}

export abstract class AuthTokenService {
  abstract issue(userId: string): IssuedAuthToken;

  abstract verify(token: string): VerifiedAuthToken | null;
}
