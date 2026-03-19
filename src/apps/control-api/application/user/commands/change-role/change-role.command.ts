import { Role } from '@/apps/control-api/domain/user';

export interface ChangeRoleCommand {
  actorId: string;
  targetUserId: string;
  role: Role;
}
