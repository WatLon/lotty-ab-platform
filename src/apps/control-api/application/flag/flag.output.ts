import { FlagValueType } from '@/apps/control-api/domain/flag';

export interface FlagOutput {
  id: string;
  key: string;
  valueType: FlagValueType;
  defaultValue: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}
