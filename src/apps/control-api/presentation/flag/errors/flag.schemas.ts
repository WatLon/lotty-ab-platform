import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { FlagErrorCode } from '@/apps/control-api/domain/flag';
import { errorSchema } from '@/shared/presentation/common/errors/schema-builders';
import { SchemaRegistry } from '@/shared/presentation/common/errors/schema-registry';

const schemas: Record<FlagErrorCode, SchemaObject> = {
  [FlagErrorCode.FLAG_KEY_ALREADY_EXISTS]: errorSchema(
    FlagErrorCode.FLAG_KEY_ALREADY_EXISTS,
    'Flag with key "button_color" already exists',
    {
      key: { type: 'string', example: 'button_color' },
    },
  ),
};

SchemaRegistry.register(schemas);

export { FlagErrorCode };
