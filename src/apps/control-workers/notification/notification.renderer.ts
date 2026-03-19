import { Injectable } from '@nestjs/common';
import { ControlDomainEventEnvelope } from '@/contracts/control-domain-event-envelope';
import { isPlainObject } from '@/shared/domain/common';

export interface NotificationRenderContext {
  event: ControlDomainEventEnvelope;
  payload: Record<string, unknown>;
  experimentId: string;
  experimentName: string;
  flagKey: string;
  ownerId: string;
  severity: string;
  environment: string;
}

@Injectable()
export class NotificationRenderer {
  render(template: string | null, context: NotificationRenderContext): string {
    if (!template) {
      return [
        `Event: ${context.event.eventName}`,
        `Experiment: ${context.experimentName} (${context.experimentId})`,
        `Flag: ${context.flagKey}`,
        `Owner: ${context.ownerId}`,
        `Environment: ${context.environment}`,
        `Severity: ${context.severity}`,
        `Event ID: ${context.event.eventId}`,
      ].join('\n');
    }
    const model: Record<string, unknown> = {
      event: {
        name: context.event.eventName,
        id: context.event.eventId,
        occurredOn: context.event.occurredOn,
      },
      experiment: {
        id: context.experimentId,
        name: context.experimentName,
        flagKey: context.flagKey,
        ownerId: context.ownerId,
      },
      payload: context.payload,
      severity: context.severity,
      environment: context.environment,
    };
    return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, path: string) => {
      const value = this.resolvePath(model, path);
      if (value === undefined || value === null) return '';
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);

      return JSON.stringify(value);
    });
  }

  private resolvePath(root: Record<string, unknown>, path: string): unknown {
    let current: unknown = root;
    for (const segment of path.split('.')) {
      if (!isPlainObject(current)) return undefined;

      current = current[segment];
    }
    return current;
  }
}
