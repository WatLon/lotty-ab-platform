import * as z from 'zod';

export const ControlDomainEventEnvelope = z.object({
  aggregateType: z.string(),
  aggregateId: z.string(),
  eventName: z.string(),
  eventId: z.string(),
  occurredOn: z.string(),
  version: z.number().nullable(),
  payload: z.unknown(),
});

export type ControlDomainEventEnvelope = z.infer<typeof ControlDomainEventEnvelope>;
