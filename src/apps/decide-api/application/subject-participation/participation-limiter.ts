export interface SubjectParticipationMeta {
  windowStartMs: number;
  assignmentsInWindow: number;
  cooldownUntilMs: number;
}

export interface SubjectParticipationState {
  version: number;
  activeExperiments: Map<string, string | null>;
  meta: SubjectParticipationMeta;
}
export abstract class ParticipationLimiter {
  abstract getState(subjectId: string): Promise<SubjectParticipationState>;
  abstract putIfVersion(
    subjectId: string,
    expectedVersion: number,
    nextState: SubjectParticipationState,
  ): Promise<boolean>;
  abstract removeExperimentForSubjects(experimentId: string, subjectIds: string[]): Promise<void>;
}
