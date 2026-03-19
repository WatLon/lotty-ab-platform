import { ReviewDecision } from '@/apps/control-api/domain/experiment';

export interface SubmitReviewCommand {
  actorId: string;
  experimentId: string;
  decision: ReviewDecision;
  comment: string | null;
}
