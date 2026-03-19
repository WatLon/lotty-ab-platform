import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ExperimentStatus, ReviewDecision } from '@/apps/control-api/domain/experiment';
import { DecideUseCase } from '@/apps/decide-api/application';
import { DecisionReason } from '@/apps/decide-api/domain';
import { InMemoryRuntimeSnapshotProvider } from '@/apps/decide-api/infrastructure/runtime-snapshot.provider';
import { IngestEventsUseCase } from '@/apps/ingest-api/application';
import { InMemoryEventTypeCatalogProvider } from '@/apps/ingest-api/infrastructure/event-type-catalog.provider';
import { closeE2EContext, createE2EContext, E2EContext } from '../e2e/bootstrap';
import { applyMigrations, resetDatabase } from '../e2e/db';

applyMigrations();
describe('decide+ingest integration', () => {
  let context: E2EContext;
  let decideUseCase: DecideUseCase;
  let ingestEventsUseCase: IngestEventsUseCase;
  let runtimeSnapshotProvider: InMemoryRuntimeSnapshotProvider;
  let eventTypeCatalog: InMemoryEventTypeCatalogProvider;
  beforeAll(async () => {
    context = await createE2EContext();
    decideUseCase = context.app.get(DecideUseCase);
    ingestEventsUseCase = context.app.get(IngestEventsUseCase);
    runtimeSnapshotProvider = context.app.get(InMemoryRuntimeSnapshotProvider);
    eventTypeCatalog = context.app.get(InMemoryEventTypeCatalogProvider);
  });
  beforeEach(async () => {
    await resetDatabase(context.prisma);
    runtimeSnapshotProvider.reset();
    runtimeSnapshotProvider.markReady();
    eventTypeCatalog.reset();
    eventTypeCatalog.markReady();
  });
  afterAll(async () => {
    await closeE2EContext(context);
  });
  it('resolves assigned decision and ingests a linked event', async () => {
    const ownerId = crypto.randomUUID();
    await context.prisma.user.create({
      data: {
        id: ownerId,
        email: `owner-${crypto.randomUUID().slice(0, 8)}@example.com`,
        password: 'SecurePass123',
        name: 'Owner',
        role: 'EXPERIMENTER',
      },
    });
    const flag = await context.prisma.flag.create({
      data: {
        key: `integration_flag_${crypto.randomUUID().slice(0, 8)}`,
        valueType: 'STRING',
        defaultValue: 'A',
      },
    });
    const experiment = await context.prisma.experiment.create({
      data: {
        name: 'Integration Experiment',
        flagId: flag.id,
        ownerId,
        status: ExperimentStatus.RUNNING,
        audiencePercent: 100,
        reviews: {
          create: {
            reviewerId: ownerId,
            decision: ReviewDecision.APPROVED,
            comment: 'seeded for integration test',
          },
        },
        variants: {
          create: [
            { name: 'Control', value: 'A', weight: 50, isControl: true },
            { name: 'Treatment', value: 'B', weight: 50, isControl: false },
          ],
        },
      },
      include: { variants: true },
    });
    await context.prisma.eventType.create({
      data: {
        key: `event.${crypto.randomUUID().slice(0, 8)}.conversion`,
        name: 'Conversion',
        requiresExposure: false,
      },
    });
    const eventType = await context.prisma.eventType.findFirstOrThrow();
    runtimeSnapshotProvider.apply({
      flag: {
        id: flag.id,
        key: flag.key,
        valueType: flag.valueType,
        defaultValue: flag.defaultValue,
        description: flag.description,
        createdAt: flag.createdAt.toISOString(),
        updatedAt: flag.updatedAt?.toISOString() ?? null,
      },
      experiment: {
        id: experiment.id,
        flagId: experiment.flagId,
        status: experiment.status,
        conflictDomain: experiment.conflictDomain,
        priority: experiment.priority,
        audiencePercent: experiment.audiencePercent,
        targetingRule: experiment.targetingRule,
        variants: experiment.variants.map((variant) => ({
          id: variant.id,
          value: variant.value,
          weight: variant.weight,
          isControl: variant.isControl,
        })),
      },
      generatedAt: new Date().toISOString(),
    });
    eventTypeCatalog.apply({
      id: eventType.id,
      key: eventType.key,
      schema: eventType.schema,
      requiresExposure: eventType.requiresExposure,
      isArchived: eventType.isArchived,
      createdAt: eventType.createdAt.toISOString(),
      updatedAt: eventType.updatedAt?.toISOString() ?? null,
    });
    const decideResult = await decideUseCase.execute({
      subjectId: 'integration-subject-1',
      attributes: { country: 'RU' },
      flagKeys: [flag.key],
    });
    expect(decideResult.isOk()).toBe(true);
    if (decideResult.isErr()) return;
    expect(decideResult.value).toHaveLength(1);
    expect(decideResult.value[0].reason).toBe(DecisionReason.EXPERIMENT_ASSIGNED);
    expect(decideResult.value[0].experimentId).toBe(experiment.id);
    const ingestResult = await ingestEventsUseCase.execute({
      events: [
        {
          eventId: `evt-${crypto.randomUUID()}`,
          eventTypeKey: (await context.prisma.eventType.findFirstOrThrow()).key,
          decisionId: decideResult.value[0].decisionId,
          subjectId: 'integration-subject-1',
          payload: { source: 'integration' },
          timestamp: new Date(),
        },
      ],
    });
    expect(ingestResult.isOk()).toBe(true);
    if (ingestResult.isErr()) return;
    expect(ingestResult.value.accepted).toBe(1);
    expect(ingestResult.value.rejected).toBe(0);
  });
  it('rejects event ingestion when decision subject does not match event subject', async () => {
    const ownerId = crypto.randomUUID();
    await context.prisma.user.create({
      data: {
        id: ownerId,
        email: `owner-${crypto.randomUUID().slice(0, 8)}@example.com`,
        password: 'SecurePass123',
        name: 'Owner',
        role: 'EXPERIMENTER',
      },
    });
    const flag = await context.prisma.flag.create({
      data: {
        key: `integration_flag_${crypto.randomUUID().slice(0, 8)}`,
        valueType: 'STRING',
        defaultValue: 'A',
      },
    });
    const experiment = await context.prisma.experiment.create({
      data: {
        name: 'Integration Experiment',
        flagId: flag.id,
        ownerId,
        status: ExperimentStatus.RUNNING,
        audiencePercent: 100,
        variants: {
          create: [
            { name: 'Control', value: 'A', weight: 50, isControl: true },
            { name: 'Treatment', value: 'B', weight: 50, isControl: false },
          ],
        },
      },
      include: { variants: true },
    });
    const eventType = await context.prisma.eventType.create({
      data: {
        key: `event.${crypto.randomUUID().slice(0, 8)}.conversion`,
        name: 'Conversion',
        requiresExposure: false,
      },
    });
    runtimeSnapshotProvider.apply({
      flag: {
        id: flag.id,
        key: flag.key,
        valueType: flag.valueType,
        defaultValue: flag.defaultValue,
        description: flag.description,
        createdAt: flag.createdAt.toISOString(),
        updatedAt: flag.updatedAt?.toISOString() ?? null,
      },
      experiment: {
        id: experiment.id,
        flagId: experiment.flagId,
        status: experiment.status,
        conflictDomain: experiment.conflictDomain,
        priority: experiment.priority,
        audiencePercent: experiment.audiencePercent,
        targetingRule: experiment.targetingRule,
        variants: experiment.variants.map((variant) => ({
          id: variant.id,
          value: variant.value,
          weight: variant.weight,
          isControl: variant.isControl,
        })),
      },
      generatedAt: new Date().toISOString(),
    });
    eventTypeCatalog.apply({
      id: eventType.id,
      key: eventType.key,
      schema: eventType.schema,
      requiresExposure: eventType.requiresExposure,
      isArchived: eventType.isArchived,
      createdAt: eventType.createdAt.toISOString(),
      updatedAt: eventType.updatedAt?.toISOString() ?? null,
    });
    const decideResult = await decideUseCase.execute({
      subjectId: 'integration-subject-A',
      attributes: { country: 'RU' },
      flagKeys: [flag.key],
    });
    expect(decideResult.isOk()).toBe(true);
    if (decideResult.isErr()) return;
    const ingestResult = await ingestEventsUseCase.execute({
      events: [
        {
          eventId: `evt-${crypto.randomUUID()}`,
          eventTypeKey: eventType.key,
          decisionId: decideResult.value[0].decisionId,
          subjectId: 'integration-subject-B',
          timestamp: new Date(),
        },
      ],
    });
    expect(ingestResult.isOk()).toBe(true);
    if (ingestResult.isErr()) return;
    expect(ingestResult.value.accepted).toBe(0);
    expect(ingestResult.value.rejected).toBe(1);
    expect(ingestResult.value.errors[0].code).toBe('DECISION_SUBJECT_MISMATCH');
  });
});
