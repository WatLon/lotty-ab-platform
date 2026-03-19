import { Injectable } from '@nestjs/common';
import type { Decision } from '@/apps/decide-api/domain';
import { DecideContext, DecideService, DecisionReason } from '@/apps/decide-api/domain';
import { ParticipationPolicy } from '@/apps/decide-api/domain/subject-participation/participation-policy';
import { DecisionTokenSigner } from '@/contracts/decision-token';
import { AppLogger } from '@/shared/application';
import { ok, Result } from '@/shared/domain/common';
import { DecideCommand } from './decide.command';
import { FlagDecisionOutput } from './decide.output';
import { DecisionAnalyticsRepository } from './decision-analytics.repository';
import { RuntimeSnapshotProvider } from './runtime-snapshot.provider';
import { ExperimentAssignmentService } from './services/experiment-assignment.service';
import { FlagResolver } from './services/flag.resolver';
import { ParticipationLimiter } from './subject-participation/participation-limiter';

@Injectable()
export class DecideUseCase {
  constructor(
    private readonly resolver: FlagResolver,
    private readonly assigner: ExperimentAssignmentService,
    private readonly decider: DecideService,
    private readonly analytics: DecisionAnalyticsRepository,
    private readonly policy: ParticipationPolicy,
    private readonly limiter: ParticipationLimiter,
    private readonly signer: DecisionTokenSigner,
    private readonly snapshot: RuntimeSnapshotProvider,
    private readonly logger: AppLogger,
  ) {}

  async execute(command: DecideCommand): Promise<Result<FlagDecisionOutput[], never>> {
    if (!this.snapshot.isReady()) {
      return ok(
        command.flagKeys
          .map((k) => k.trim())
          .filter((k) => k.length > 0)
          .map((flagKey) => ({
            flagKey,
            value: '',
            decisionId: this.signDecisionId(command.subjectId, null, null),
            reason: DecisionReason.SNAPSHOT_NOT_READY,
            experimentId: null,
            variantId: null,
          })),
      );
    }
    const context: DecideContext = {
      subjectId: command.subjectId,
      attributes: command.attributes,
    };

    const resolved = this.resolver.resolve(command.flagKeys);
    const state = await this.limiter.getState(command.subjectId);
    const activeExperiments = new Map(state.activeExperiments);
    let isDirty = false;
    const activeExperimentIds = this.snapshot.getActiveExperimentIds();

    for (const experimentId of Array.from(activeExperiments.keys())) {
      if (!activeExperimentIds.has(experimentId)) {
        activeExperiments.delete(experimentId);
        isDirty = true;
      }
    }

    const occupiedDomains = new Map<string, string>();
    for (const [experimentId, domain] of activeExperiments) {
      if (domain) occupiedDomains.set(domain, experimentId);
    }

    const decisions = this.assigner.allocate({
      flags: resolved.flags,
      experimentsByFlagId: resolved.experimentsByFlagId,
      context,
      occupiedDomains,
    });
    const flagsByPriority = [...resolved.flags].sort((a, b) => {
      const ae = resolved.experimentsByFlagId[a.id];
      const be = resolved.experimentsByFlagId[b.id];
      const ap = ae?.priority ?? -1;
      const bp = be?.priority ?? -1;
      if (ap !== bp) return bp - ap;

      return (ae?.id ?? '').localeCompare(be?.id ?? '');
    });

    let nextMeta = state.meta;
    const nowMs = Date.now();

    for (const flag of flagsByPriority) {
      const decision = decisions.get(flag.id);
      if (
        !decision ||
        decision.reason !== DecisionReason.EXPERIMENT_ASSIGNED ||
        !decision.experimentId
      ) {
        continue;
      }
      const experimentId = decision.experimentId;
      if (activeExperiments.has(experimentId)) continue;

      if (
        this.policy.isCooldownActive(nextMeta, nowMs) ||
        activeExperiments.size >= this.policy.maxConcurrentExperiments
      ) {
        decisions.set(
          flag.id,
          this.decider.buildLimitExceededDecision(flag, experimentId, context),
        );
        continue;
      }
      const experiment = resolved.experimentsByFlagId[flag.id];
      activeExperiments.set(experimentId, experiment?.conflictDomain ?? null);
      nextMeta = this.policy.recordAssignment(nextMeta, nowMs);
      isDirty = true;
    }

    if (isDirty) {
      void this.limiter
        .putIfVersion(command.subjectId, state.version, {
          version: state.version + 1,
          activeExperiments,
          meta: nextMeta,
        })
        .catch((error: unknown) => {
          this.logger.warn({
            event: 'application.decision.state.persist.deferred_failed',
            domain: 'application',
            operation: 'DecideUseCase.execute',
            status: 'failure',
            meta: {
              subjectId: command.subjectId,
              expectedVersion: state.version,
              error: error instanceof Error ? error.message : String(error),
            },
          });
        });
    }

    const finalDecisions: Decision[] = [];
    for (const flag of resolved.flags) {
      const decision = decisions.get(flag.id);
      if (decision) finalDecisions.push(decision);
    }

    if (finalDecisions.length > 0) {
      void this.analytics.saveMany(finalDecisions).catch((error: unknown) => {
        this.logger.error(
          {
            event: 'application.decision.persist.failed',
            domain: 'application',
            operation: 'DecideUseCase.persistAnalytics',
            status: 'failure',
            meta: { decisionsCount: finalDecisions.length },
          },
          error,
          'failed to persist decisions to analytics store',
        );
      });
    }

    const flagsByKey = new Map(resolved.flags.map((f) => [f.key, f]));
    const output: FlagDecisionOutput[] = [];
    for (const { rawKey, key } of resolved.requestedKeys) {
      const flag = flagsByKey.get(key);
      if (!flag) continue;

      const decision = decisions.get(flag.id);
      if (!decision) continue;

      output.push({
        flagKey: rawKey,
        value: decision.value,
        decisionId: this.signDecisionId(
          decision.subjectId,
          decision.experimentId,
          decision.variantId,
        ),
        reason: decision.reason,
        experimentId: decision.experimentId,
        variantId: decision.variantId,
      });
    }

    return ok(output);
  }

  private signDecisionId(
    subjectId: string,
    experimentId: string | null,
    variantId: string | null,
  ): string {
    return this.signer.signDecisionToken({
      e: experimentId ?? '',
      v: variantId ?? '',
      u: subjectId,
    });
  }
}
