export interface EventTypeOutput {
  id: string;
  key: string;
  name: string;
  description: string | null;
  schema: unknown;
  requiresExposure: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}
