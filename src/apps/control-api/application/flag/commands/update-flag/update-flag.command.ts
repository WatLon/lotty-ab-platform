export interface UpdateFlagCommand {
  actorId: string;
  flagId: string;
  defaultValue: string;
  description?: string | null;
}
