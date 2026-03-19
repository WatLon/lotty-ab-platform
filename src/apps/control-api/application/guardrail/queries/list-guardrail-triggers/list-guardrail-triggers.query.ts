import { GuardrailAction } from '@/apps/control-api/domain/guardrail';
import { PaginationParams } from '@/shared/application/pagination';

export interface ListGuardrailTriggersQuery extends PaginationParams {
  actorId: string;
  experimentId: string;
  guardrailId?: string;
  actionTaken?: GuardrailAction;
}
