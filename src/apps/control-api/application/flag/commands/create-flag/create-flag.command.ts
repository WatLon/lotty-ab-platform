import { FlagValueType } from '@/apps/control-api/domain/flag';

export interface CreateFlagCommand {
  actorId: string;
  key: string;
  valueType: FlagValueType;
  defaultValue: string;
  description: string | null;
}
