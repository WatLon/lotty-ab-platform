import { Prisma, GuardrailRule as PrismaGuardrailRule } from '@generated/prisma/client';
import { Injectable } from '@nestjs/common';
import {
  GuardrailRule,
  GuardrailRuleAlreadyExistsError,
  GuardrailRuleId,
  GuardrailRuleRepository,
} from '@/apps/control-api/domain/guardrail';
import {
  PRISMA_COMPARISON_OPERATOR_BY_DOMAIN_COMPARISON_OPERATOR,
  PRISMA_GUARDRAIL_ACTION_BY_DOMAIN_GUARDRAIL_ACTION,
} from '@/apps/control-api/infrastructure/guardrail/guardrail.types';
import { AppLogger } from '@/shared/application';
import { err, ok, Result, toError } from '@/shared/domain/common';
import {
  PrismaRepositoryBase,
  PrismaTransactionManager,
  prismaUpdateWithOptimisticLock,
} from '@/shared/infrastructure/persistence';
import { GuardrailRuleMapper } from './guardrail-rule.mapper';

@Injectable()
export class GuardrailRulePrismaRepository
  extends PrismaRepositoryBase<
    GuardrailRule,
    PrismaGuardrailRule,
    GuardrailRuleId,
    GuardrailRuleAlreadyExistsError
  >
  implements GuardrailRuleRepository
{
  protected readonly entityName = 'GuardrailRule';

  constructor(
    txManager: PrismaTransactionManager,
    private readonly appLogger: AppLogger,
    mapper: GuardrailRuleMapper,
  ) {
    super(txManager, mapper);
  }

  async findById(id: GuardrailRuleId): Promise<GuardrailRule | null> {
    return this.findOne(this.client.guardrailRule.findUnique({ where: { id: id.value } }));
  }

  async findByExperimentId(experimentId: string): Promise<GuardrailRule[]> {
    return this.findMany(
      this.client.guardrailRule.findMany({
        where: { experimentId },
        orderBy: { createdAt: 'desc' },
      }),
    );
  }

  async delete(id: GuardrailRuleId): Promise<boolean> {
    const result = await this.client.guardrailRule.deleteMany({
      where: { id: id.value },
    });
    return result.count > 0;
  }

  protected async doCreate(
    entity: GuardrailRule,
    version: number,
  ): Promise<Result<void, GuardrailRuleAlreadyExistsError>> {
    try {
      await this.client.guardrailRule.create({
        data: {
          id: entity.id.value,
          experimentId: entity.experimentId,
          metricId: entity.metricId,
          threshold: entity.threshold,
          operator: PRISMA_COMPARISON_OPERATOR_BY_DOMAIN_COMPARISON_OPERATOR[entity.operator],
          windowMinutes: entity.windowMinutes,
          action: PRISMA_GUARDRAIL_ACTION_BY_DOMAIN_GUARDRAIL_ACTION[entity.action],
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt ?? new Date(),
          version,
        },
      });
      return ok(undefined);
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        return err(this.buildDuplicateRuleError(entity));
      }
      throw toError(error);
    }
  }

  protected async doUpdate(
    entity: GuardrailRule,
    currentVersion: number,
    newVersion: number,
  ): Promise<Result<boolean, GuardrailRuleAlreadyExistsError>> {
    try {
      const updated = await prismaUpdateWithOptimisticLock({
        appLogger: this.appLogger,
        operation: 'GuardrailRulePrismaRepository.doUpdate',
        entity: this.entityName,
        entityId: entity.id.value,
        currentVersion,
        newVersion,
        update: async () => {
          await this.client.guardrailRule.update({
            where: { id: entity.id.value, version: currentVersion },
            data: {
              metricId: entity.metricId,
              threshold: entity.threshold,
              operator: PRISMA_COMPARISON_OPERATOR_BY_DOMAIN_COMPARISON_OPERATOR[entity.operator],
              windowMinutes: entity.windowMinutes,
              action: PRISMA_GUARDRAIL_ACTION_BY_DOMAIN_GUARDRAIL_ACTION[entity.action],
              updatedAt: entity.updatedAt ?? new Date(),
              version: newVersion,
            },
          });
        },
      });
      return ok(updated);
    } catch (error: unknown) {
      if (this.isUniqueViolation(error)) {
        return err(this.buildDuplicateRuleError(entity));
      }
      throw toError(error);
    }
  }

  private isUniqueViolation(error: unknown): error is Prisma.PrismaClientKnownRequestError {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }

  private buildDuplicateRuleError(entity: GuardrailRule): GuardrailRuleAlreadyExistsError {
    return new GuardrailRuleAlreadyExistsError({
      experimentId: entity.experimentId,
      metricId: entity.metricId,
      threshold: entity.threshold,
      operator: entity.operator,
      windowMinutes: entity.windowMinutes,
      action: entity.action,
    });
  }
}
