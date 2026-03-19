import { Prisma } from '@generated/prisma/client';
import { isPlainObject } from '@/shared/domain/common';
export function isInputJsonValue(value: unknown): value is Prisma.InputJsonValue {
  if (value === null) return true;

  switch (typeof value) {
    case 'string':
    case 'boolean':
      return true;
    case 'number':
      return Number.isFinite(value);
    case 'object': {
      if (Array.isArray(value)) return value.every(isInputJsonValue);
      if (!isPlainObject(value)) return false;

      for (const v of Object.values(value)) {
        if (!isInputJsonValue(v)) return false;
      }
      return true;
    }
    default:
      return false;
  }
}
export function toPrismaJson(value: unknown, errorMessage?: string): Prisma.InputJsonValue {
  if (value === undefined) {
    throw new TypeError(errorMessage ?? 'Value must be JSON-serializable (got undefined)');
  }
  if (isInputJsonValue(value)) return value;

  throw new TypeError(errorMessage ?? 'Value must be JSON-serializable');
}
export function toPrismaNullableJson(
  value: unknown,
  options?: {
    nullSentinel?: 'db' | 'json';
    errorMessage?: string;
  },
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
  if (value === undefined || value === null) {
    return options?.nullSentinel === 'json' ? Prisma.JsonNull : Prisma.DbNull;
  }
  return toPrismaJson(value, options?.errorMessage);
}
