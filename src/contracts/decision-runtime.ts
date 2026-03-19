export const FLAG_KEY_MIN_LENGTH = 1;

export const FLAG_KEY_MAX_LENGTH = 128;

export const FLAG_KEY_FORMAT = /^[a-z][a-z0-9_]*$/;

export type RuntimeFlagValueType = 'STRING' | 'NUMBER' | 'BOOLEAN';

export interface RuntimeFlagView {
  id: string;
  key: string;
  valueType: RuntimeFlagValueType;
  defaultValue: string;
  description: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface RuntimeExperimentVariantView {
  id: string;
  value: string;
  weight: number;
  isControl: boolean;
}

export type RuntimeExperimentStatus =
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'ARCHIVED'
  | 'DRAFT'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED';

export interface RuntimeExperimentView {
  id: string;
  flagId: string;
  status: RuntimeExperimentStatus;
  conflictDomain: string | null;
  priority: number;
  audiencePercent: number;
  targetingRule: unknown | null;
  variants: RuntimeExperimentVariantView[];
}

export interface RuntimeSnapshotMessage {
  flag: RuntimeFlagView;
  experiment: RuntimeExperimentView | null;
  generatedAt: string;
}
