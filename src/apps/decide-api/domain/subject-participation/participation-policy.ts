export interface ParticipationLimits {
  maxConcurrentExperiments: number;
  cooldownAfterTotal: number;
  rollingWindowMs: number;
  cooldownPeriodMs: number;
}

export interface ParticipationStats {
  windowStartMs: number;
  assignmentsInWindow: number;
  cooldownUntilMs: number;
}
export const DEFAULT_PARTICIPATION_LIMITS: ParticipationLimits = {
  maxConcurrentExperiments: 3,
  cooldownAfterTotal: 5,
  rollingWindowMs: 30 * 24 * 60 * 60 * 1000,
  cooldownPeriodMs: 24 * 60 * 60 * 1000,
};

export class ParticipationPolicy {
  private readonly limits: ParticipationLimits;

  constructor(limits: ParticipationLimits = DEFAULT_PARTICIPATION_LIMITS) {
    this.limits = limits;
  }

  get cooldownPeriodMs(): number {
    return this.limits.cooldownPeriodMs;
  }

  get maxConcurrentExperiments(): number {
    return this.limits.maxConcurrentExperiments;
  }
  isCooldownActive(stats: ParticipationStats, nowMs: number = Date.now()): boolean {
    return stats.cooldownUntilMs > nowMs;
  }
  recordAssignment(stats: ParticipationStats, nowMs: number = Date.now()): ParticipationStats {
    const normalized = this.normalizeWindow(stats, nowMs);
    const assignmentsInWindow = normalized.assignmentsInWindow + 1;
    const cooldownUntilMs =
      assignmentsInWindow >= this.limits.cooldownAfterTotal
        ? Math.max(normalized.cooldownUntilMs, nowMs + this.limits.cooldownPeriodMs)
        : normalized.cooldownUntilMs;
    return {
      windowStartMs: normalized.windowStartMs,
      assignmentsInWindow,
      cooldownUntilMs,
    };
  }

  private normalizeWindow(stats: ParticipationStats, nowMs: number): ParticipationStats {
    const currentWindowStart = stats.windowStartMs;
    if (currentWindowStart <= 0 || nowMs - currentWindowStart >= this.limits.rollingWindowMs) {
      return {
        ...stats,
        windowStartMs: nowMs,
        assignmentsInWindow: 0,
      };
    }
    return stats;
  }
}
