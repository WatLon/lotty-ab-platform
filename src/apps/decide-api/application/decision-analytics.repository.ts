import type { Decision } from '@/apps/decide-api/domain';
import { Result } from '@/shared/domain/common';
export abstract class DecisionAnalyticsRepository {
  abstract saveMany(decisions: Decision[]): Promise<Result<void, never>>;
}
