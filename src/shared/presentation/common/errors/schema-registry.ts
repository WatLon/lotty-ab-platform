import {
  ReferenceObject,
  SchemaObject,
} from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

const schemas: Record<string, SchemaObject> = {};

export const SchemaRegistry = {
  register(newSchemas: Record<string, SchemaObject>): void {
    Object.assign(schemas, newSchemas);
  },
  getAll(): Record<string, SchemaObject> {
    return schemas;
  },
  ref(code: string): ReferenceObject {
    return { $ref: `#/components/schemas/${code}Error` };
  },
  oneOf(codes: string[]): SchemaObject | ReferenceObject {
    if (codes.length === 1) {
      return this.ref(codes[0]);
    }
    return {
      oneOf: codes.map((c) => this.ref(c)),
      discriminator: {
        propertyName: 'code',
        mapping: Object.fromEntries(codes.map((c) => [c, `#/components/schemas/${c}Error`])),
      },
    };
  },
};
