export interface RuntimeEventTypeView {
  id: string;
  key: string;
  schema: unknown;
  requiresExposure: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string | null;
}
