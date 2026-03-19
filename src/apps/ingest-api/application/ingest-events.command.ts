export interface IngestEventInput {
  eventId: string;
  eventTypeKey: string;
  decisionId: string;
  subjectId: string;
  payload?: Record<string, unknown> | null;
  timestamp: Date;
}

export interface IngestEventsCommand {
  events: IngestEventInput[];
}
