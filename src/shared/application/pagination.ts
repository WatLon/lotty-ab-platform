export interface PaginationParams {
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;
export function normalizePagination(params?: PaginationParams): Required<PaginationParams> {
  const limit = Math.min(Math.max(params?.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(params?.offset ?? 0, 0);
  return { limit, offset };
}
