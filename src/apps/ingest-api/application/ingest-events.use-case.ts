import { Injectable } from '@nestjs/common';
import {
  BatchTooLargeError,
  DecisionSubjectMismatchError,
  EventTypeArchivedError,
  EventTypeCatalogNotReadyError,
  InvalidDecisionIdError,
  InvalidEventPayloadError,
  QueueUnavailableError,
  UnknownEventTypeError,
  validateEventPayloadBySchema,
} from '@/apps/ingest-api/domain';
import { DecisionTokenSigner } from '@/contracts/decision-token';
import { err, ok, Result } from '@/shared/domain/common';
import { EventTypeCatalogProvider } from './event-type-catalog.provider';
import { IngestEventsCommand } from './ingest-events.command';
import { IngestDomainError, IngestEventsOutput } from './ingest-events.output';
import { IngestEventsBatch, IngestEventsQueue, QueuedIngestEvent } from './ingest-events-queue';

@Injectable()
export class IngestEventsUseCase {
  private static readonly MAX_BATCH_SIZE = 1000;

  constructor(
    private readonly eventTypeCatalog: EventTypeCatalogProvider,
    private readonly decisionTokenSigner: DecisionTokenSigner,
    private readonly ingestEventQueue: IngestEventsQueue,
  ) {}

  async execute(
    command: IngestEventsCommand,
  ): Promise<Result<IngestEventsOutput, QueueUnavailableError>> {
    if (command.events.length === 0) {
      return ok({ accepted: 0, duplicates: 0, rejected: 0, errors: [] });
    }

    if (command.events.length > IngestEventsUseCase.MAX_BATCH_SIZE) {
      const errors = command.events.map(
        (event, index) =>
          new BatchTooLargeError({
            index,
            eventId: event.eventId,
            maxBatchSize: IngestEventsUseCase.MAX_BATCH_SIZE,
            batchSize: command.events.length,
          }),
      );
      return ok({ accepted: 0, duplicates: 0, rejected: command.events.length, errors });
    }

    if (!this.eventTypeCatalog.isReady()) {
      return ok({
        accepted: 0,
        duplicates: 0,
        rejected: command.events.length,
        errors: command.events.map(
          (event, index) =>
            new EventTypeCatalogNotReadyError({
              index,
              eventId: event.eventId,
            }),
        ),
      });
    }

    const uniqueEventTypeKeys = Array.from(
      new Set(command.events.map((event) => event.eventTypeKey)),
    );

    const eventTypesByKey = this.eventTypeCatalog.getByKeys(uniqueEventTypeKeys);

    let accepted = 0;
    let duplicates = 0;
    let rejected = 0;

    const errors: IngestEventsOutput['errors'] = [];
    const receivedAtIso = new Date().toISOString();
    const seenEventIds = new Set<string>();

    const pending: Array<{
      index: number;
      eventId: string | null;
      event: QueuedIngestEvent;
    }> = [];

    for (const [index, input] of command.events.entries()) {
      if (seenEventIds.has(input.eventId)) {
        duplicates += 1;
        continue;
      }

      seenEventIds.add(input.eventId);

      const eventType = eventTypesByKey[input.eventTypeKey];

      if (!eventType) {
        rejected = this.reject(
          rejected,
          errors,
          new UnknownEventTypeError({
            index,
            eventId: input.eventId,
            eventTypeKey: input.eventTypeKey,
          }),
        );
        continue;
      }

      if (eventType.isArchived) {
        rejected = this.reject(
          rejected,
          errors,
          new EventTypeArchivedError({
            index,
            eventId: input.eventId,
            eventTypeKey: input.eventTypeKey,
          }),
        );
        continue;
      }

      const payload = this.decisionTokenSigner.verifyDecisionToken(input.decisionId);
      if (!payload) {
        rejected = this.reject(
          rejected,
          errors,
          new InvalidDecisionIdError({
            index,
            eventId: input.eventId,
          }),
        );
        continue;
      }

      if (payload.u !== input.subjectId) {
        rejected = this.reject(
          rejected,
          errors,
          new DecisionSubjectMismatchError({
            index,
            eventId: input.eventId,
          }),
        );
        continue;
      }

      const payloadValidationError = validateEventPayloadBySchema(
        input.payload ?? null,
        eventType.schema ?? null,
      );
      if (payloadValidationError) {
        rejected = this.reject(
          rejected,
          errors,
          new InvalidEventPayloadError({
            index,
            eventId: input.eventId,
            eventTypeKey: input.eventTypeKey,
            schemaError: payloadValidationError,
          }),
        );
        continue;
      }

      pending.push({
        index,
        eventId: input.eventId,
        event: {
          id: crypto.randomUUID(),
          eventId: input.eventId,
          eventTypeKey: input.eventTypeKey,
          eventTypeId: eventType.id,
          decisionId: input.decisionId,
          subjectId: input.subjectId,
          experimentId: payload.e || null,
          variantId: payload.v || null,
          payload: input.payload ?? null,
          timestampIso: input.timestamp.toISOString(),
          receivedAtIso,
          requiresExposure: eventType.requiresExposure,
          attributed: !eventType.requiresExposure,
        },
      });
    }

    if (pending.length > 0) {
      const batch: IngestEventsBatch = {
        batchId: crypto.randomUUID(),
        events: pending.map((item) => item.event),
      };
      const enqueueResult = await this.ingestEventQueue.enqueue(batch);
      if (enqueueResult.isErr()) {
        const firstFailed = pending[0];
        return err(
          new QueueUnavailableError({
            index: firstFailed?.index ?? 0,
            eventId: firstFailed?.eventId ?? null,
          }),
        );
      }
      accepted = pending.length;
    }

    return ok({ accepted, duplicates, rejected, errors });
  }

  private reject(rejected: number, errors: IngestDomainError[], error: IngestDomainError): number {
    errors.push(error);
    return rejected + 1;
  }
}
