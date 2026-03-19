import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { errorSchema } from './schema-builders';
import { SchemaRegistry } from './schema-registry';

export const InfraErrorCode = {
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  CONCURRENCY_CONFLICT: 'CONCURRENCY_CONFLICT',
} as const;

export type InfraErrorCode = (typeof InfraErrorCode)[keyof typeof InfraErrorCode];

const schemas: Record<InfraErrorCode, SchemaObject> = {
  [InfraErrorCode.NOT_FOUND]: errorSchema(InfraErrorCode.NOT_FOUND, 'User with id 123 not found', {
    entity: { type: 'string', example: 'User' },
    id: { type: 'string', example: '123' },
  }),
  [InfraErrorCode.FORBIDDEN]: errorSchema(
    InfraErrorCode.FORBIDDEN,
    'Access to Message is forbidden',
    {
      resource: { type: 'string', example: 'Message' },
      resourceId: { type: 'string', example: '123' },
    },
  ),
  [InfraErrorCode.CONCURRENCY_CONFLICT]: errorSchema(
    InfraErrorCode.CONCURRENCY_CONFLICT,
    'Entity was modified by another process',
    {
      entity: { type: 'string', example: 'Message' },
      entityId: { type: 'string', example: '123' },
    },
  ),
};

SchemaRegistry.register(schemas);
