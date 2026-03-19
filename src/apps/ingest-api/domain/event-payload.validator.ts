import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true, strict: false });
export function validateEventPayloadBySchema(payload: unknown, schema: unknown): string | null {
  if (!schema) return null;

  try {
    const validate = ajv.compile(schema as object);
    if (validate(payload)) return null;

    const first = validate.errors?.[0];
    return first ? `${first.instancePath || 'payload'} ${first.message}` : 'validation failed';
  } catch (e) {
    return `invalid schema: ${e instanceof Error ? e.message : 'unknown'}`;
  }
}
