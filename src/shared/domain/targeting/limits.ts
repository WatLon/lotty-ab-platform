export interface TargetingDslLimits {
  maxDepth: number;
  maxNodes: number;
}

export const DEFAULT_TARGETING_DSL_LIMITS: TargetingDslLimits = {
  maxDepth: 12,
  maxNodes: 128,
};
