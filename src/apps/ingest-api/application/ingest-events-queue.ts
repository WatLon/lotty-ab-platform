import { QueueUnavailableError } from '@/apps/ingest-api/domain';
import { Result } from '@/shared/domain/common';

export interface QueuedIngestEvent {
  id: string;
  eventId: string;
  eventTypeKey: string;
  eventTypeId: string;
  decisionId: string;
  subjectId: string;
  experimentId: string | null;
  variantId: string | null;
  payload: Record<string, unknown> | null;
  timestampIso: string;
  receivedAtIso: string;
  requiresExposure: boolean;
  attributed: boolean;
}

export interface IngestEventsBatch {
  batchId: string;
  events: QueuedIngestEvent[];
}
export abstract class IngestEventsQueue {
  abstract enqueue(batch: IngestEventsBatch): Promise<Result<void, QueueUnavailableError>>;
}
