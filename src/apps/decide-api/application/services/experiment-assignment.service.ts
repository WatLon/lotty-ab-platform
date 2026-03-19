import { Injectable } from '@nestjs/common';
import type { Decision } from '@/apps/decide-api/domain';
import { DecideContext, DecideService, DecisionReason } from '@/apps/decide-api/domain';
import { RuntimeExperimentView, RuntimeFlagView } from '@/contracts/decision-runtime';

@Injectable()
export class ExperimentAssignmentService {
  constructor(private readonly decideService: DecideService) {}
  allocate(params: {
    flags: RuntimeFlagView[];
    experimentsByFlagId: Record<string, RuntimeExperimentView | null>;
    context: DecideContext;
    occupiedDomains: ReadonlyMap<string, string>;
  }): Map<string, Decision> {
    const { flags, experimentsByFlagId, context, occupiedDomains } = params;
    const decisions = new Map<string, Decision>();
    const occupiedDomainsCopy = new Map(occupiedDomains);
    const withExperiment: Array<{
      flag: RuntimeFlagView;
      experiment: RuntimeExperimentView;
    }> = [];
    const withoutExperiment: RuntimeFlagView[] = [];
    for (const flag of flags) {
      const experiment = experimentsByFlagId[flag.id] ?? null;
      if (experiment) {
        withExperiment.push({ flag, experiment });
      } else {
        withoutExperiment.push(flag);
      }
    }
    withExperiment.sort((a, b) =>
      a.experiment.priority !== b.experiment.priority
        ? b.experiment.priority - a.experiment.priority
        : a.experiment.id.localeCompare(b.experiment.id),
    );
    for (const flag of withoutExperiment) {
      decisions.set(
        flag.id,
        this.decideService.buildDefaultDecision(flag, context, DecisionReason.FLAG_DEFAULT),
      );
    }
    for (const { flag, experiment } of withExperiment) {
      const domain = experiment.conflictDomain;
      const conflictOwner = domain ? occupiedDomainsCopy.get(domain) : undefined;
      if (domain && conflictOwner && conflictOwner !== experiment.id) {
        decisions.set(
          flag.id,
          this.decideService.buildDefaultDecision(
            flag,
            context,
            DecisionReason.EXPERIMENT_CONFLICT,
          ),
        );
        continue;
      }
      const decision = this.decideService.decide(flag, experiment, context);
      decisions.set(flag.id, decision);
      if (decision.reason === DecisionReason.EXPERIMENT_ASSIGNED && domain) {
        occupiedDomainsCopy.set(domain, experiment.id);
      }
    }
    return decisions;
  }
}
