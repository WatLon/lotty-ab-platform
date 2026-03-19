import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { ExperimentErrorCode } from '@/apps/control-api/domain/experiment';
import { errorSchema } from '@/shared/presentation/common/errors/schema-builders';
import { SchemaRegistry } from '@/shared/presentation/common/errors/schema-registry';

const schemas: Record<ExperimentErrorCode, SchemaObject> = {
  [ExperimentErrorCode.EXPERIMENT_ALREADY_EXISTS_FOR_FLAG]: errorSchema(
    ExperimentErrorCode.EXPERIMENT_ALREADY_EXISTS_FOR_FLAG,
    'An active experiment already exists for this flag',
    { flagId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' } },
  ),
  [ExperimentErrorCode.EXPERIMENT_FROZEN]: errorSchema(
    ExperimentErrorCode.EXPERIMENT_FROZEN,
    'Experiment configuration is frozen',
  ),
  [ExperimentErrorCode.INVALID_STATUS_TRANSITION]: errorSchema(
    ExperimentErrorCode.INVALID_STATUS_TRANSITION,
    'Cannot transition from "DRAFT" to "RUNNING"',
    {
      currentStatus: { type: 'string', example: 'DRAFT' },
      targetStatus: { type: 'string', example: 'RUNNING' },
    },
  ),
  [ExperimentErrorCode.EXPERIMENT_NOT_EDITABLE]: errorSchema(
    ExperimentErrorCode.EXPERIMENT_NOT_EDITABLE,
    'Experiment cannot be edited in status "RUNNING"',
    { status: { type: 'string', example: 'RUNNING' } },
  ),
  [ExperimentErrorCode.VARIANTS_WEIGHT_MISMATCH]: errorSchema(
    ExperimentErrorCode.VARIANTS_WEIGHT_MISMATCH,
    'Sum of variant weights must equal audience percent',
    {
      totalWeight: { type: 'number', example: 30 },
      audiencePercent: { type: 'number', example: 20 },
    },
  ),
  [ExperimentErrorCode.NO_CONTROL_VARIANT]: errorSchema(
    ExperimentErrorCode.NO_CONTROL_VARIANT,
    'Experiment must have exactly one control variant',
  ),
  [ExperimentErrorCode.MULTIPLE_CONTROL_VARIANTS]: errorSchema(
    ExperimentErrorCode.MULTIPLE_CONTROL_VARIANTS,
    'Experiment cannot have more than one control variant',
  ),
  [ExperimentErrorCode.MINIMUM_VARIANTS_REQUIRED]: errorSchema(
    ExperimentErrorCode.MINIMUM_VARIANTS_REQUIRED,
    'Experiment must have at least 2 variants',
  ),
  [ExperimentErrorCode.VARIANT_NOT_FOUND]: errorSchema(
    ExperimentErrorCode.VARIANT_NOT_FOUND,
    'Variant not found',
    { variantId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' } },
  ),
  [ExperimentErrorCode.CANNOT_REMOVE_LAST_VARIANT]: errorSchema(
    ExperimentErrorCode.CANNOT_REMOVE_LAST_VARIANT,
    'Cannot remove the last variant',
  ),
  [ExperimentErrorCode.OUTCOME_REQUIRED_FOR_COMPLETION]: errorSchema(
    ExperimentErrorCode.OUTCOME_REQUIRED_FOR_COMPLETION,
    'Outcome is required to complete experiment',
  ),
  [ExperimentErrorCode.COMPLETION_COMMENT_REQUIRED]: errorSchema(
    ExperimentErrorCode.COMPLETION_COMMENT_REQUIRED,
    'Completion comment is required',
  ),
  [ExperimentErrorCode.WINNER_VARIANT_REQUIRED]: errorSchema(
    ExperimentErrorCode.WINNER_VARIANT_REQUIRED,
    'Winner variant is required for ROLLOUT_WINNER outcome',
  ),
  [ExperimentErrorCode.NOT_AUTHORIZED_TO_REVIEW]: errorSchema(
    ExperimentErrorCode.NOT_AUTHORIZED_TO_REVIEW,
    'User is not authorized to review this experiment',
    {
      experimentId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
      reviewerId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174001' },
    },
  ),
  [ExperimentErrorCode.ALREADY_REVIEWED]: errorSchema(
    ExperimentErrorCode.ALREADY_REVIEWED,
    'User has already submitted a review for this experiment',
    {
      experimentId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
      reviewerId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174001' },
    },
  ),
};

SchemaRegistry.register(schemas);

export { ExperimentErrorCode };
