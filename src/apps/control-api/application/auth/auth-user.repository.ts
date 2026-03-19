import { Role } from '@/apps/control-api/domain/user';

export interface AuthUserCredentials {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
}

export interface AuthUserIdentity {
  id: string;
  role: Role;
}

export interface CreateBootstrapAdminInput {
  email: string;
  passwordHash: string;
  name: string;
}

export abstract class AuthUserRepository {
  abstract findCredentialsByEmail(email: string): Promise<AuthUserCredentials | null>;

  abstract findIdentityById(id: string): Promise<AuthUserIdentity | null>;

  abstract countUsers(): Promise<number>;

  abstract createBootstrapAdmin(input: CreateBootstrapAdminInput): Promise<string>;
}
