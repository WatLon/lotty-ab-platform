import { DecisionReason } from './decision-reason.enum';

export interface Decision {
  id: string;
  subjectId: string;
  flagId: string;
  experimentId: string | null;
  variantId: string | null;
  value: string;
  reason: DecisionReason;
  subjectAttributes: Record<string, unknown> | null;
  createdAt: Date;
}
