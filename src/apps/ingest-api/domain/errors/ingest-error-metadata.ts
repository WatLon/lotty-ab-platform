export interface IngestErrorMetadataBase {
  index: number;
  eventId: string | null;
}

export interface IngestErrorWithEventTypeKeyMetadata extends IngestErrorMetadataBase {
  eventTypeKey: string;
}

export interface IngestErrorWithPayloadMetadata extends IngestErrorWithEventTypeKeyMetadata {
  schemaError: string;
}
