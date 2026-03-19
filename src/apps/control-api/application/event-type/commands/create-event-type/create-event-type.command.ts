export interface CreateEventTypeCommand {
  actorId: string;
  key: string;
  name: string;
  description: string | null;
  schema: Record<string, unknown> | null;
  requiresExposure: boolean;
}
