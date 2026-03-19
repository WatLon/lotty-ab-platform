export interface UpdateEventTypeCommand {
  actorId: string;
  eventTypeId: string;
  name?: string;
  description?: string | null;
  schema?: unknown;
}
