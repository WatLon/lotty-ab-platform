import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { GuardrailErrorCode } from '@/apps/control-api/domain/guardrail';
import { errorSchema } from '@/shared/presentation/common/errors/schema-builders';
import { SchemaRegistry } from '@/shared/presentation/common/errors/schema-registry';

const schemas: Record<GuardrailErrorCode, SchemaObject> = {
  [GuardrailErrorCode.GUARDRAIL_RULE_ALREADY_EXISTS]: errorSchema(
    GuardrailErrorCode.GUARDRAIL_RULE_ALREADY_EXISTS,
    'Guardrail rule with the same settings already exists',
    {
      experimentId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
      metricId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174111' },
      threshold: { type: 'number', example: 0.03 },
      operator: { type: 'string', example: 'GT' },
      windowMinutes: { type: 'number', example: 10 },
      action: { type: 'string', example: 'PAUSE' },
    },
  ),
};

SchemaRegistry.register(schemas);

export { GuardrailErrorCode };
