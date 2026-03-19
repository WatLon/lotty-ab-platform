import { Role } from '@/apps/control-api/domain/user';

export interface AuthenticatedUser {
  id: string;
  role: Role;
}
