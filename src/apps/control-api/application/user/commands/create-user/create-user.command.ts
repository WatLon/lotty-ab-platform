import { Role } from '@/apps/control-api/domain/user';

export interface CreateUserCommand {
  email: string;
  password: string;
  name: string;
  role: Role | null;
}
