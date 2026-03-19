import { Flag as PrismaFlag, FlagValueType as PrismaFlagValueType } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import {
  Flag,
  FlagDefaultValue,
  FlagId,
  FlagKey,
  FlagValueType,
} from '@/apps/control-api/domain/flag';
import { PersistenceMapper } from '@/shared/infrastructure/persistence';

export const DOMAIN_VALUE_TYPE_BY_PRISMA_VALUE_TYPE: Record<PrismaFlagValueType, FlagValueType> = {
  STRING: FlagValueType.STRING,
  NUMBER: FlagValueType.NUMBER,
  BOOLEAN: FlagValueType.BOOLEAN,
};

@Injectable()
export class FlagMapper implements PersistenceMapper<Flag, PrismaFlag> {
  toDomain(raw: PrismaFlag): Flag {
    return Flag.reconstitute(
      {
        key: FlagKey.reconstitute(raw.key),
        valueType: DOMAIN_VALUE_TYPE_BY_PRISMA_VALUE_TYPE[raw.valueType],
        defaultValue: FlagDefaultValue.reconstitute(raw.defaultValue),
        description: raw.description,
        createdAt: raw.createdAt,
        updatedAt: raw.updatedAt,
      },
      FlagId.from(raw.id),
    );
  }
}
