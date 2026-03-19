import { GuardrailRule as PrismaGuardrailRule } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import { GuardrailRule, GuardrailRuleId } from '@/apps/control-api/domain/guardrail';
import {
  DOMAIN_COMPARISON_OPERATOR_BY_PRISMA_COMPARISON_OPERATOR,
  DOMAIN_GUARDRAIL_ACTION_BY_PRISMA_GUARDRAIL_ACTION,
} from '@/apps/control-api/infrastructure/guardrail/guardrail.types';
import { PersistenceMapper } from '@/shared/infrastructure/persistence';

@Injectable()
export class GuardrailRuleMapper implements PersistenceMapper<GuardrailRule, PrismaGuardrailRule> {
  toDomain(raw: PrismaGuardrailRule): GuardrailRule {
    return GuardrailRule.reconstitute(
      {
        experimentId: raw.experimentId,
        metricId: raw.metricId,
        threshold: raw.threshold,
        operator: DOMAIN_COMPARISON_OPERATOR_BY_PRISMA_COMPARISON_OPERATOR[raw.operator],
        windowMinutes: raw.windowMinutes,
        action: DOMAIN_GUARDRAIL_ACTION_BY_PRISMA_GUARDRAIL_ACTION[raw.action],
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      },
      GuardrailRuleId.from(raw.id),
    );
  }
}
