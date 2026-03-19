import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

type MetadataSchema = Record<
  string,
  {
    type: string;
    example: unknown;
  }
>;

export function errorSchema(
  code: string,
  message: string,
  metadata?: MetadataSchema,
): SchemaObject {
  const properties: NonNullable<SchemaObject['properties']> = {
    code: { type: 'string', enum: [code] },
    message: { type: 'string', example: message },
  };
  const schema: SchemaObject = {
    type: 'object',
    required: ['code', 'message'],
    properties,
  };
  if (metadata) {
    properties.metadata = {
      type: 'object',
      properties: metadata,
    };
  }
  return schema;
}

export function validationSchema(
  code: string,
  message: string,
  field: string,
  metadata?: MetadataSchema,
): SchemaObject {
  const properties: NonNullable<SchemaObject['properties']> = {
    code: { type: 'string', enum: [code] },
    message: { type: 'string', example: message },
    field: { type: 'string', example: field },
  };
  const schema: SchemaObject = {
    type: 'object',
    required: ['code', 'message', 'field'],
    properties,
  };
  if (metadata) {
    properties.metadata = {
      type: 'object',
      properties: metadata,
    };
  }
  return schema;
}
