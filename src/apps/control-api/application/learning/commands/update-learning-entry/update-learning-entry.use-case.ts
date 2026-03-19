import { Injectable } from '@nestjs/common';
import { ExperimentId, ExperimentRepository } from '@/apps/control-api/domain/experiment';
import {
  LearningActionTaken,
  LearningCountry,
  LearningEntry,
  LearningEntryId,
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
import { UpdateLearningEntryCommand } from './update-learning-entry.command';

interface ParsedPatch {
  title?: LearningTitle;
  hypothesis?: LearningHypothesis;
  primaryMetricKey?: MetricKey;
  actionTaken?: LearningActionTaken;
  summary?: LearningSummary;
  featureKey?: LearningFeatureKey | null;
  team?: LearningTeam | null;
  notes?: LearningNote | null;
  reportUrl?: LearningReportUrl | null;
  ticketUrl?: LearningTicketUrl | null;
  guardrailMetricKeys?: MetricKey[];
  tags?: LearningTag[];
  countries?: LearningCountry[];
  platforms?: LearningPlatform[];
}

@Injectable()
export class UpdateLearningEntryUseCase {
  constructor(
    private readonly entries: LearningEntryRepository,
    private readonly users: UserRepository,
    private readonly experiments: ExperimentRepository,
    private readonly txManager: TransactionManager,
  ) {}

  async execute(
    command: UpdateLearningEntryCommand,
  ): Promise<Result<void, NotFoundError | ForbiddenError | ValidationErrors | ConcurrencyError>> {
    return this.txManager.execute(async () => {
      const actorId = UserId.from(command.actorId);

      const actor = await this.users.findById(actorId);
      if (!actor) return err(new NotFoundError('user', actorId));

      if (!actor.isExperimenter()) return err(new ForbiddenError('learningEntry', actorId));

      const learningId = LearningEntryId.from(command.learningId);
      const entry = await this.entries.findById(learningId);
      if (!entry) return err(new NotFoundError('learningEntry', learningId));

      if (command.experimentId !== undefined && command.experimentId !== null) {
        const experimentId = ExperimentId.from(command.experimentId);
        const experiment = await this.experiments.findById(experimentId);
        if (!experiment) return err(new NotFoundError('experiment', experimentId));
      }

      const parseResult = this.parseInputs(command);
      if (parseResult.isErr()) return err(parseResult.error);

      this.applyPatch(entry, parseResult.value, command);
      entry.markUpdatedBy(actor.id);

      const saveResult = await this.entries.save(entry);
      if (saveResult.isErr()) return err(saveResult.error);

      return ok(undefined);
    });
  }

  private parseInputs(command: UpdateLearningEntryCommand): Result<ParsedPatch, ValidationErrors> {
    const scalarsResult = Result.combineAll({
      title: Result.validateOptional(command.title, LearningTitle.create),
      hypothesis: Result.validateOptional(command.hypothesis, LearningHypothesis.create),
      primaryMetricKey: Result.validateOptional(command.primaryMetricKey, MetricKey.create),
      actionTaken: Result.validateOptional(command.actionTaken, LearningActionTaken.create),
      summary: Result.validateOptional(command.summary, LearningSummary.create),
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

  private applyPatch(
    entry: LearningEntry,
    parsed: ParsedPatch,
    command: UpdateLearningEntryCommand,
  ): void {
    if (command.experimentId !== undefined) entry.changeExperimentId(command.experimentId ?? null);
    if (command.result !== undefined) entry.changeResult(command.result);

    if (parsed.title !== undefined) entry.changeTitle(parsed.title);
    if (parsed.hypothesis !== undefined) entry.changeHypothesis(parsed.hypothesis);
    if (parsed.primaryMetricKey !== undefined)
      entry.changePrimaryMetricKey(parsed.primaryMetricKey);
    if (parsed.actionTaken !== undefined) entry.changeActionTaken(parsed.actionTaken);
    if (parsed.summary !== undefined) entry.changeSummary(parsed.summary);

    if (parsed.featureKey !== undefined) entry.changeFeatureKey(parsed.featureKey);
    if (parsed.team !== undefined) entry.changeTeam(parsed.team);
    if (parsed.notes !== undefined) entry.changeNotes(parsed.notes);
    if (parsed.reportUrl !== undefined) entry.changeReportUrl(parsed.reportUrl);
    if (parsed.ticketUrl !== undefined) entry.changeTicketUrl(parsed.ticketUrl);

    if (parsed.guardrailMetricKeys !== undefined)
      entry.replaceGuardrailMetricKeys(parsed.guardrailMetricKeys);
    if (parsed.tags !== undefined) entry.replaceTags(parsed.tags);
    if (parsed.countries !== undefined) entry.replaceCountries(parsed.countries);
    if (parsed.platforms !== undefined) entry.replacePlatforms(parsed.platforms);
  }
}
