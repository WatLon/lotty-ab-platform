import { Injectable } from '@nestjs/common';
import { ExperimentId, ExperimentRepository } from '@/apps/control-api/domain/experiment';
import {
  LearningActionTaken,
  LearningCountry,
  LearningEntry,
  LearningEntryRepository,
  LearningFeatureKey,
  LearningHypothesis,
  LearningNote,
  LearningPlatform,
  LearningReportUrl,
  LearningSummary,
  LearningTag,
  LearningTeam,
  LearningTicketUrl,
  LearningTitle,
} from '@/apps/control-api/domain/learning';
import { MetricKey } from '@/apps/control-api/domain/metric';
import { UserId, UserRepository } from '@/apps/control-api/domain/user';
import { TransactionManager } from '@/shared/application';
import {
  ConcurrencyError,
  err,
  ForbiddenError,
  NotFoundError,
  ok,
  Result,
  ValidationError,
  ValidationErrors,
} from '@/shared/domain/common';
import { CreateLearningEntryCommand } from './create-learning-entry.command';

interface ParsedFields {
  title: LearningTitle;
  hypothesis: LearningHypothesis;
  primaryMetricKey: MetricKey;
  actionTaken: LearningActionTaken;
  summary: LearningSummary;
  featureKey: LearningFeatureKey | null;
  team: LearningTeam | null;
  notes: LearningNote | null;
  reportUrl: LearningReportUrl | null;
  ticketUrl: LearningTicketUrl | null;
  guardrailMetricKeys: MetricKey[];
  tags: LearningTag[];
  countries: LearningCountry[];
  platforms: LearningPlatform[];
}

@Injectable()
export class CreateLearningEntryUseCase {
  constructor(
    private readonly entries: LearningEntryRepository,
    private readonly users: UserRepository,
    private readonly experiments: ExperimentRepository,
    private readonly txManager: TransactionManager,
  ) {}

  async execute(
    command: CreateLearningEntryCommand,
  ): Promise<
    Result<{ id: string }, NotFoundError | ForbiddenError | ValidationErrors | ConcurrencyError>
  > {
    return this.txManager.execute(async () => {
      const actorId = UserId.from(command.actorId);

      const actor = await this.users.findById(actorId);
      if (!actor) return err(new NotFoundError('user', actorId));

      if (!actor.isExperimenter()) return err(new ForbiddenError('learningEntry', actorId));

      if (command.experimentId) {
        const experimentId = ExperimentId.from(command.experimentId);
        const experiment = await this.experiments.findById(experimentId);
        if (!experiment) return err(new NotFoundError('experiment', experimentId));
      }

      const parseResult = this.parseInputs(command);
      if (parseResult.isErr()) return err(parseResult.error);

      const entryResult = LearningEntry.create({
        ...parseResult.value,
        experimentId: command.experimentId,
        result: command.result,
        createdById: actor.id,
      });
      if (entryResult.isErr()) return err(entryResult.error);

      const saveResult = await this.entries.save(entryResult.value);
      if (saveResult.isErr()) return err(saveResult.error);

      return ok({ id: entryResult.value.id.value });
    });
  }

  private parseInputs(command: CreateLearningEntryCommand): Result<ParsedFields, ValidationErrors> {
    const scalarsResult = Result.combineAll({
      title: LearningTitle.create(command.title),
      hypothesis: LearningHypothesis.create(command.hypothesis),
      primaryMetricKey: MetricKey.create(command.primaryMetricKey),
      actionTaken: LearningActionTaken.create(command.actionTaken),
      summary: LearningSummary.create(command.summary),
      featureKey: Result.validateNullable(command.featureKey, LearningFeatureKey.create),
      team: Result.validateNullable(command.team, LearningTeam.create),
      notes: Result.validateNullable(command.notes, LearningNote.create),
      reportUrl: Result.validateNullable(command.reportUrl, LearningReportUrl.create),
      ticketUrl: Result.validateNullable(command.ticketUrl, LearningTicketUrl.create),
    });

    const arraysResult = Result.combineAll({
      guardrailMetricKeys: Result.validateArray(command.guardrailMetricKeys, MetricKey.create),
      tags: Result.validateArray(command.tags, LearningTag.create),
      countries: Result.validateArray(command.countries, LearningCountry.create),
      platforms: Result.validateArray(command.platforms, LearningPlatform.create),
    });

    if (scalarsResult.isOk() && arraysResult.isOk()) {
      return ok({ ...scalarsResult.value, ...arraysResult.value });
    }

    const errors: ValidationError[] = [];
    if (scalarsResult.isErr()) errors.push(...scalarsResult.error);
    if (arraysResult.isErr()) errors.push(...arraysResult.error);

    return err(new ValidationErrors(errors));
  }
}
