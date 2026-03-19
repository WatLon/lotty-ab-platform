import Ajv from 'ajv';
import { isPlainObject } from '@/shared/domain/common';

const ajv = new Ajv({ allErrors: true, strict: false });
export function validateEventTypeSchemaDefinition(schema: unknown): string | null {
  if (schema === null) return null;

  if (!isPlainObject(schema)) {
    return 'must be an object or null';
  }
  try {
    ajv.compile(schema as object);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : 'invalid JSON Schema';
  }
}
