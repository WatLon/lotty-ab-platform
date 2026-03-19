import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import * as z from 'zod';
import {
  EVENT_TYPE_KEY_FORMAT,
  EVENT_TYPE_KEY_MAX_LENGTH,
} from '@/shared/domain/event-type-key.rules';

const DECISION_TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
export const IngestEventSchema = z.object({
  eventId: z
    .string()
    .trim()
    .min(1)
    .describe('Client-generated event ID')
    .meta({ examples: ['evt-unique-123'] }),
  eventTypeKey: z
    .string()
    .trim()
    .max(EVENT_TYPE_KEY_MAX_LENGTH)
    .regex(EVENT_TYPE_KEY_FORMAT)
    .describe('Event type key')
    .meta({ examples: ['button.clicked'] }),
  decisionId: z
    .string()
    .trim()
    .min(1)
    .min(20)
    .regex(DECISION_TOKEN_PATTERN)
    .describe('Decision ID')
    .meta({
      examples: [
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlIjoiZXhwLTEiLCJ2IjoidmFyLTEiLCJ1IjoidXNlci00MiJ9.UmFsP0y5j9ZJCPx7e9RXT5nA5-1T8ScEw4rkgE3q7z8',
      ],
    }),
  subjectId: z
    .string()
    .trim()
    .min(1)
    .describe('Stable subject identifier')
    .meta({ examples: ['user-42'] }),
  payload: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Event payload')
    .meta({ examples: [{ screen: 'checkout' }] }),
  timestamp: z
    .string()
    .datetime()
    .transform((value) => new Date(value))
    .describe('Event timestamp')
    .meta({ examples: ['2025-02-14T12:00:00Z'] }),
});

export class IngestEventDto extends createZodDto(IngestEventSchema) {}
export const IngestEventsRequestSchema = z.object({
  events: z
    .array(IngestEventSchema)
    .max(1000, 'Maximum 1000 events per batch')
    .describe('Batch of events')
    .meta({
      examples: [
        [
          {
            eventId: 'evt-unique-123',
            eventTypeKey: 'button.clicked',
            decisionId:
              'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlIjoiZXhwLTEiLCJ2IjoidmFyLTEiLCJ1IjoidXNlci00MiJ9.UmFsP0y5j9ZJCPx7e9RXT5nA5-1T8ScEw4rkgE3q7z8',
            subjectId: 'user-42',
            payload: { screen: 'checkout' },
            timestamp: '2025-02-14T12:00:00Z',
          },
        ],
      ],
    }),
});

export class IngestEventsRequestDto extends createZodDto(IngestEventsRequestSchema) {}

export class IngestEventErrorDto {
  @ApiProperty({ type: Number })
  declare index: number;

  @ApiPropertyOptional({ type: String })
  declare eventId: string | null;

  @ApiProperty({ type: String })
  declare code: string;

  @ApiProperty({ type: String })
  declare message: string;
}

export class IngestEventsResponseDto {
  @ApiProperty({ type: Number })
  declare accepted: number;

  @ApiProperty({ type: Number })
  declare duplicates: number;

  @ApiProperty({ type: Number })
  declare rejected: number;

  @ApiProperty({ type: [IngestEventErrorDto] })
  declare errors: IngestEventErrorDto[];
}
