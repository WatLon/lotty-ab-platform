export interface MetricOutput {
  id: string;
  key: string;
  name: string;
  description: string | null;
  formula: unknown;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}
