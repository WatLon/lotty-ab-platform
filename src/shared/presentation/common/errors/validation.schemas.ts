import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { ValidationErrorCode } from '@/shared/domain/common/errors';
import { validationSchema } from './schema-builders';
import { SchemaRegistry } from './schema-registry';

const schemas: Record<ValidationErrorCode, SchemaObject> = {
  [ValidationErrorCode.REQUIRED]: validationSchema(
    ValidationErrorCode.REQUIRED,
    'title is required',
    'title',
  ),
  [ValidationErrorCode.TOO_LONG]: validationSchema(
    ValidationErrorCode.TOO_LONG,
    'title must be less than 255 characters',
    'title',
    {
      maxLength: { type: 'number', example: 255 },
      actualLength: { type: 'number', example: 300 },
    },
  ),
  [ValidationErrorCode.TOO_SHORT]: validationSchema(
    ValidationErrorCode.TOO_SHORT,
    'password must be at least 8 characters',
    'password',
    {
      minLength: { type: 'number', example: 8 },
      actualLength: { type: 'number', example: 5 },
    },
  ),
  [ValidationErrorCode.TOO_HIGH]: validationSchema(
    ValidationErrorCode.TOO_HIGH,
    'priority must be at most 100',
    'priority',
    {
      max: { type: 'number', example: 100 },
      actual: { type: 'number', example: 150 },
    },
  ),
  [ValidationErrorCode.TOO_LOW]: validationSchema(
    ValidationErrorCode.TOO_LOW,
    'quantity must be at least 1',
    'quantity',
    {
      min: { type: 'number', example: 1 },
      actual: { type: 'number', example: 0 },
    },
  ),
  [ValidationErrorCode.INVALID_FORMAT]: validationSchema(
    ValidationErrorCode.INVALID_FORMAT,
    'Invalid email format',
    'email',
    {
      expected: { type: 'string', example: 'valid email address' },
    },
  ),
};

SchemaRegistry.register(schemas);
