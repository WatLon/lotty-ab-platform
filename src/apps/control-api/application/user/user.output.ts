import { Role } from '@/apps/control-api/domain/user';

export interface UserOutput {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date | null;
}
