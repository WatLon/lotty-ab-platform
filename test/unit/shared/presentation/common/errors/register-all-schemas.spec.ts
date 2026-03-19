import { ApproverGroupErrorCode } from '@/apps/control-api/domain/approver-group/errors';
import { ExperimentErrorCode } from '@/apps/control-api/domain/experiment/errors';
import { FlagErrorCode } from '@/apps/control-api/domain/flag/errors';
import { UserErrorCode } from '@/apps/control-api/domain/user/errors';
import { ValidationErrorCode } from '@/shared/domain/common/errors';
import { InfraErrorCode } from '@/shared/presentation/common/errors/infra.schemas';
import { SchemaRegistry } from '@/shared/presentation/common/errors/schema-registry';
import '@/apps/control-api/presentation/approver-group/errors/approver-group.schemas';
import '@/apps/control-api/presentation/auth/errors/auth.schemas';
import '@/apps/control-api/presentation/experiment/errors/experiment.schemas';
import '@/apps/control-api/presentation/experiment/errors/guardrail.schemas';
import '@/apps/control-api/presentation/flag/errors/flag.schemas';
import '@/apps/control-api/presentation/metric/errors/metric.schemas';
import '@/apps/control-api/presentation/user/errors/user.schemas';
import '@/shared/presentation/common/errors';

describe('schema registration side effects', () => {
  it('registers shared and control-api schema maps without runtime errors', () => {
    const schemas = SchemaRegistry.getAll();

    expect(schemas[ValidationErrorCode.REQUIRED]).toBeDefined();
    expect(schemas[InfraErrorCode.NOT_FOUND]).toBeDefined();
    expect(schemas[UserErrorCode.USER_EMAIL_ALREADY_EXISTS]).toBeDefined();
    expect(schemas[FlagErrorCode.FLAG_KEY_ALREADY_EXISTS]).toBeDefined();
    expect(schemas[ApproverGroupErrorCode.APPROVER_GROUP_ALREADY_EXISTS]).toBeDefined();
    expect(schemas[ExperimentErrorCode.EXPERIMENT_ALREADY_EXISTS_FOR_FLAG]).toBeDefined();
  });
});
