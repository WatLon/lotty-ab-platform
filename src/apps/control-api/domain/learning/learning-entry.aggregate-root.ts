import { ExperimentOutcomeType } from '@/apps/control-api/domain/experiment';
import { MetricKey } from '@/apps/control-api/domain/metric';
import { UserId } from '@/apps/control-api/domain/user';
import { AggregateRoot, ok, Result } from '@/shared/domain/common';
import { LearningEntryId } from './learning-entry.id';
import {
  LearningActionTaken,
  LearningCountry,
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
} from './value-objects';

interface LearningEntryState {
  experimentId: string | null;
  featureKey: LearningFeatureKey | null;
  team: LearningTeam | null;
  title: LearningTitle;
  hypothesis: LearningHypothesis;
  primaryMetricKey: MetricKey;
  guardrailMetricKeys: MetricKey[];
  result: ExperimentOutcomeType | null;
  actionTaken: LearningActionTaken;
  summary: LearningSummary;
  notes: LearningNote | null;
  tags: LearningTag[];
  countries: LearningCountry[];
  platforms: LearningPlatform[];
  reportUrl: LearningReportUrl | null;
  ticketUrl: LearningTicketUrl | null;
  createdById: UserId;
  updatedById: UserId | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface LearningEntryProps {
  experimentId: string | null;
  featureKey: string | null;
  team: string | null;
  title: string;
  hypothesis: string;
  primaryMetricKey: string;
  guardrailMetricKeys: string[];
  result: ExperimentOutcomeType | null;
  actionTaken: string;
  summary: string;
  notes: string | null;
  tags: string[];
  countries: string[];
  platforms: string[];
  reportUrl: string | null;
  ticketUrl: string | null;
  createdById: string;
  updatedById: string | null;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}

export interface CreateLearningEntryProps {
  experimentId: string | null;
  featureKey: LearningFeatureKey | null;
  team: LearningTeam | null;
  title: LearningTitle;
  hypothesis: LearningHypothesis;
  primaryMetricKey: MetricKey;
  guardrailMetricKeys: MetricKey[];
  result: ExperimentOutcomeType | null;
  actionTaken: LearningActionTaken;
  summary: LearningSummary;
  notes: LearningNote | null;
  tags: LearningTag[];
  countries: LearningCountry[];
  platforms: LearningPlatform[];
  reportUrl: LearningReportUrl | null;
  ticketUrl: LearningTicketUrl | null;
  createdById: UserId;
}

export interface LearningEntrySnapshot {
  experimentId: string | null;
  featureKey: string | null;
  team: string | null;
  title: string;
  hypothesis: string;
  primaryMetricKey: string;
  guardrailMetricKeys: string[];
  result: ExperimentOutcomeType | null;
  actionTaken: string;
  summary: string;
  notes: string | null;
  tags: string[];
  countries: string[];
  platforms: string[];
  reportUrl: string | null;
  ticketUrl: string | null;
  createdById: string;
  updatedById: string | null;
  isArchived: boolean;
}

export class LearningEntry extends AggregateRoot<LearningEntryState, LearningEntryId> {
  private constructor(props: LearningEntryState, id: LearningEntryId) {
    super(props, id);
  }

  static create(props: CreateLearningEntryProps): Result<LearningEntry, never> {
    return ok(
      new LearningEntry(
        {
          experimentId: props.experimentId,
          featureKey: props.featureKey,
          team: props.team,
          title: props.title,
          hypothesis: props.hypothesis,
          primaryMetricKey: props.primaryMetricKey,
          guardrailMetricKeys: [...props.guardrailMetricKeys],
          result: props.result,
          actionTaken: props.actionTaken,
          summary: props.summary,
          notes: props.notes,
          tags: [...props.tags],
          countries: [...props.countries],
          platforms: [...props.platforms],
          reportUrl: props.reportUrl,
          ticketUrl: props.ticketUrl,
          createdById: props.createdById,
          updatedById: null,
          isArchived: false,
          createdAt: new Date(),
          updatedAt: null,
        },
        LearningEntryId.generate(),
      ),
    );
  }

  static reconstitute(props: LearningEntryProps, id: LearningEntryId): LearningEntry {
    return new LearningEntry(
      {
        experimentId: props.experimentId,
        featureKey: props.featureKey ? LearningFeatureKey.reconstitute(props.featureKey) : null,
        team: props.team ? LearningTeam.reconstitute(props.team) : null,
        title: LearningTitle.reconstitute(props.title),
        hypothesis: LearningHypothesis.reconstitute(props.hypothesis),
        primaryMetricKey: MetricKey.reconstitute(props.primaryMetricKey),
        guardrailMetricKeys: props.guardrailMetricKeys.map((metricKey) =>
          MetricKey.reconstitute(metricKey),
        ),
        result: props.result,
        actionTaken: LearningActionTaken.reconstitute(props.actionTaken),
        summary: LearningSummary.reconstitute(props.summary),
        notes: props.notes ? LearningNote.reconstitute(props.notes) : null,
        tags: props.tags.map((tag) => LearningTag.reconstitute(tag)),
        countries: props.countries.map((country) => LearningCountry.reconstitute(country)),
        platforms: props.platforms.map((platform) => LearningPlatform.reconstitute(platform)),
        reportUrl: props.reportUrl ? LearningReportUrl.reconstitute(props.reportUrl) : null,
        ticketUrl: props.ticketUrl ? LearningTicketUrl.reconstitute(props.ticketUrl) : null,
        createdById: UserId.from(props.createdById),
        updatedById: props.updatedById ? UserId.from(props.updatedById) : null,
        isArchived: props.isArchived,
        createdAt: props.createdAt,
        updatedAt: props.updatedAt,
      },
      id,
    );
  }

  get experimentId(): string | null {
    return this.props.experimentId;
  }

  get featureKey(): string | null {
    return this.props.featureKey?.value ?? null;
  }

  get team(): string | null {
    return this.props.team?.value ?? null;
  }

  get title(): string {
    return this.props.title.value;
  }

  get hypothesis(): string {
    return this.props.hypothesis.value;
  }

  get primaryMetricKey(): string {
    return this.props.primaryMetricKey.value;
  }

  get guardrailMetricKeys(): string[] {
    return this.props.guardrailMetricKeys.map((metricKey) => metricKey.value);
  }

  get result(): ExperimentOutcomeType | null {
    return this.props.result;
  }

  get actionTaken(): string {
    return this.props.actionTaken.value;
  }

  get summary(): string {
    return this.props.summary.value;
  }

  get notes(): string | null {
    return this.props.notes?.value ?? null;
  }

  get tags(): string[] {
    return this.props.tags.map((tag) => tag.value);
  }

  get countries(): string[] {
    return this.props.countries.map((country) => country.value);
  }

  get platforms(): string[] {
    return this.props.platforms.map((platform) => platform.value);
  }

  get reportUrl(): string | null {
    return this.props.reportUrl?.value ?? null;
  }

  get ticketUrl(): string | null {
    return this.props.ticketUrl?.value ?? null;
  }

  get createdById(): string {
    return this.props.createdById.value;
  }

  get updatedById(): string | null {
    return this.props.updatedById?.value ?? null;
  }

  get isArchived(): boolean {
    return this.props.isArchived;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date | null {
    return this.props.updatedAt;
  }

  changeExperimentId(experimentId: string | null): void {
    if (experimentId === this.props.experimentId) return;

    this.props.experimentId = experimentId;
    this.touch();
  }

  changeFeatureKey(featureKey: LearningFeatureKey | null): void {
    if (LearningEntry.areOptionalVoEqual(this.props.featureKey, featureKey)) return;

    this.props.featureKey = featureKey;
    this.touch();
  }

  changeTeam(team: LearningTeam | null): void {
    if (LearningEntry.areOptionalVoEqual(this.props.team, team)) return;

    this.props.team = team;
    this.touch();
  }

  changeTitle(title: LearningTitle): void {
    if (this.props.title.equals(title)) return;

    this.props.title = title;
    this.touch();
  }

  changeHypothesis(hypothesis: LearningHypothesis): void {
    if (this.props.hypothesis.equals(hypothesis)) return;

    this.props.hypothesis = hypothesis;
    this.touch();
  }

  changePrimaryMetricKey(metricKey: MetricKey): void {
    if (this.props.primaryMetricKey.equals(metricKey)) return;

    this.props.primaryMetricKey = metricKey;
    this.touch();
  }

  replaceGuardrailMetricKeys(metricKeys: MetricKey[]): void {
    if (LearningEntry.areVoArraysEqual(this.props.guardrailMetricKeys, metricKeys)) return;

    this.props.guardrailMetricKeys = [...metricKeys];
    this.touch();
  }

  changeResult(result: ExperimentOutcomeType | null): void {
    if (this.props.result === result) return;

    this.props.result = result;
    this.touch();
  }

  changeActionTaken(actionTaken: LearningActionTaken): void {
    if (this.props.actionTaken.equals(actionTaken)) return;

    this.props.actionTaken = actionTaken;
    this.touch();
  }

  changeSummary(summary: LearningSummary): void {
    if (this.props.summary.equals(summary)) return;

    this.props.summary = summary;
    this.touch();
  }

  changeNotes(notes: LearningNote | null): void {
    if (LearningEntry.areOptionalVoEqual(this.props.notes, notes)) return;

    this.props.notes = notes;
    this.touch();
  }

  replaceTags(tags: LearningTag[]): void {
    if (LearningEntry.areVoArraysEqual(this.props.tags, tags)) return;

    this.props.tags = [...tags];
    this.touch();
  }

  replaceCountries(countries: LearningCountry[]): void {
    if (LearningEntry.areVoArraysEqual(this.props.countries, countries)) return;

    this.props.countries = [...countries];
    this.touch();
  }

  replacePlatforms(platforms: LearningPlatform[]): void {
    if (LearningEntry.areVoArraysEqual(this.props.platforms, platforms)) return;

    this.props.platforms = [...platforms];
    this.touch();
  }

  changeReportUrl(reportUrl: LearningReportUrl | null): void {
    if (LearningEntry.areOptionalVoEqual(this.props.reportUrl, reportUrl)) return;

    this.props.reportUrl = reportUrl;
    this.touch();
  }

  changeTicketUrl(ticketUrl: LearningTicketUrl | null): void {
    if (LearningEntry.areOptionalVoEqual(this.props.ticketUrl, ticketUrl)) return;

    this.props.ticketUrl = ticketUrl;
    this.touch();
  }

  markUpdatedBy(actorId: UserId): void {
    this.props.updatedById = actorId;
    this.touch();
  }

  archive(actorId: UserId): void {
    if (this.props.isArchived) return;

    this.props.isArchived = true;
    this.props.updatedById = actorId;
    this.touch();
  }

  toSnapshot(): LearningEntrySnapshot {
    return {
      experimentId: this.props.experimentId,
      featureKey: this.props.featureKey?.value ?? null,
      team: this.props.team?.value ?? null,
      title: this.props.title.value,
      hypothesis: this.props.hypothesis.value,
      primaryMetricKey: this.props.primaryMetricKey.value,
      guardrailMetricKeys: this.props.guardrailMetricKeys.map((metricKey) => metricKey.value),
      result: this.props.result,
      actionTaken: this.props.actionTaken.value,
      summary: this.props.summary.value,
      notes: this.props.notes?.value ?? null,
      tags: this.props.tags.map((tag) => tag.value),
      countries: this.props.countries.map((country) => country.value),
      platforms: this.props.platforms.map((platform) => platform.value),
      reportUrl: this.props.reportUrl?.value ?? null,
      ticketUrl: this.props.ticketUrl?.value ?? null,
      createdById: this.props.createdById.value,
      updatedById: this.props.updatedById?.value ?? null,
      isArchived: this.props.isArchived,
    };
  }

  private touch(): void {
    this.props.updatedAt = new Date();
  }

  private static areOptionalVoEqual<T extends { equals(other: T): boolean }>(
    left: T | null,
    right: T | null,
  ): boolean {
    if (!left && !right) return true;
    if (!left || !right) return false;

    return left.equals(right);
  }

  private static areVoArraysEqual<T extends { equals(other: T): boolean }>(
    left: T[],
    right: T[],
  ): boolean {
    if (left.length !== right.length) return false;

    for (let index = 0; index < left.length; index += 1) {
      if (!left[index]!.equals(right[index]!)) return false;
    }

    return true;
  }
}
