import { PaginationParams } from '@/shared/application/pagination';

export interface ListReviewsQuery extends PaginationParams {
  experimentId: string;
}
