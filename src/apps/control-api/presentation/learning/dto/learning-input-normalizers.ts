import * as z from 'zod';

function normalizeOptionalNullableString(value: unknown): unknown {
  if (value === undefined || value === null) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toNormalizedUniqueStringArray(values: string[] | undefined): string[] | undefined {
  if (values === undefined) {
    return undefined;
  }

  const normalizedValues = values.map((value) => value.trim()).filter((value) => value.length > 0);

  return Array.from(new Set(normalizedValues));
}

export function optionalNullableString(maxLength: number) {
  return z.preprocess(
    normalizeOptionalNullableString,
    z.string().min(1).max(maxLength).nullable().optional(),
  );
}

export function optionalNullableUuid() {
  return z.preprocess(normalizeOptionalNullableString, z.string().uuid().nullable().optional());
}

export function optionalNullableUrl(maxLength: number) {
  return z.preprocess(
    normalizeOptionalNullableString,
    z.string().max(maxLength).url().nullable().optional(),
  );
}

export function optionalNormalizedUniqueStringArray(maxLength: number) {
  return z
    .array(z.string())
    .optional()
    .transform((values) => toNormalizedUniqueStringArray(values))
    .pipe(z.array(z.string().min(1).max(maxLength)).optional());
}
