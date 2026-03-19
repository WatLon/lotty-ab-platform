import { describe, expect, it } from 'vitest';
import { NotificationRenderer } from '@/apps/control-workers/notification/notification.renderer';
import { ControlDomainEventEnvelope } from '@/contracts/control-domain-event-envelope';

function createContext() {
  const event: ControlDomainEventEnvelope = {
    aggregateType: 'Experiment',
    aggregateId: 'exp-1',
    eventName: 'GuardrailTriggered',
    eventId: 'evt-1',
    occurredOn: '2026-02-23T00:00:00.000Z',
    version: 1,
    payload: { metricKey: 'errors.rate' },
  };
  return {
    event,
    payload: { metricKey: 'errors.rate' },
    experimentId: 'exp-1',
    experimentName: 'Checkout Ramp',
    flagKey: 'checkout_ramp',
    ownerId: 'owner-1',
    severity: 'high',
    environment: 'production',
  } as const;
}
describe('NotificationRenderer', () => {
  it('renders default message when template is empty', () => {
    const renderer = new NotificationRenderer();
    const message = renderer.render(null, createContext());
    expect(message).toContain('Event: GuardrailTriggered');
    expect(message).toContain('Severity: high');
    expect(message).toContain('Environment: production');
  });
  it('renders template placeholders with nested paths', () => {
    const renderer = new NotificationRenderer();
    const message = renderer.render(
      'exp={{experiment.name}} env={{environment}} ev={{event.name}} metric={{payload.metricKey}}',
      createContext(),
    );
    expect(message).toBe(
      'exp=Checkout Ramp env=production ev=GuardrailTriggered metric=errors.rate',
    );
  });
});
