export interface IngestEventMessage {
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
  events: IngestEventMessage[];
}
