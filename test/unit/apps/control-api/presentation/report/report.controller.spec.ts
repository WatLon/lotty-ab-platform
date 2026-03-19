import { describe, expect, it } from 'vitest';
import {
  type ExperimentReportOutput,
  GetExperimentReportUseCase,
} from '@/apps/control-api/application/report';
import { GetExperimentReportQuerySchema } from '@/apps/control-api/presentation/report/dto/get-experiment-report.query.dto';
import { ReportController } from '@/apps/control-api/presentation/report/report.controller';
import { NotFoundError, ok, Result } from '@/shared/domain/common';

class GetExperimentReportUseCaseStub {
  lastQuery: {
    experimentId: string;
    from: Date;
    to: Date;
    bucket: 'minute' | 'hour';
  } | null = null;

  async execute(query: {
    experimentId: string;
    from: Date;
    to: Date;
    bucket: 'minute' | 'hour';
  }): Promise<Result<ExperimentReportOutput, NotFoundError>> {
    this.lastQuery = query;

    return ok({
      experimentId: query.experimentId,
      from: query.from.toISOString(),
      to: query.to.toISOString(),
      bucket: query.bucket,
      variants: [],
    });
  }
}

describe('ReportController', () => {
  it('validates report query params via zod dto schema', () => {
    expect(() =>
      GetExperimentReportQuerySchema.parse({
        from: '2026-02-01T10:00:00.000Z',
        to: '2026-02-01T11:00:00.000Z',
        bucket: 'day',
      }),
    ).toThrow();

    expect(() =>
      GetExperimentReportQuerySchema.parse({
        from: 'not-a-date',
        to: '2026-02-01T11:00:00.000Z',
        bucket: 'minute',
      }),
    ).toThrow();

    expect(() =>
      GetExperimentReportQuerySchema.parse({
        from: '2026-02-01T10:00:00.000Z',
        to: 'not-a-date',
        bucket: 'hour',
      }),
    ).toThrow();

    expect(() =>
      GetExperimentReportQuerySchema.parse({
        from: '2026-02-01T11:00:00.000Z',
        to: '2026-02-01T11:00:00.000Z',
        bucket: 'minute',
      }),
    ).toThrow();
  });

  it('uses minute bucket by default and aligns from/to boundaries', async () => {
    const useCase = new GetExperimentReportUseCaseStub();
    const controller = new ReportController(useCase as unknown as GetExperimentReportUseCase);
    const query = GetExperimentReportQuerySchema.parse({
      from: '2026-02-01T10:12:13.000Z',
      to: '2026-02-01T10:13:01.000Z',
    });

    const response = await controller.getExperimentReport('exp-1', query);

    expect(useCase.lastQuery).not.toBeNull();
    expect(useCase.lastQuery?.bucket).toBe('minute');
    expect(useCase.lastQuery?.from.toISOString()).toBe('2026-02-01T10:12:00.000Z');
    expect(useCase.lastQuery?.to.toISOString()).toBe('2026-02-01T10:14:00.000Z');
    expect(response).toEqual({
      experimentId: 'exp-1',
      from: '2026-02-01T10:12:00.000Z',
      to: '2026-02-01T10:14:00.000Z',
      bucket: 'minute',
      variants: [],
    });
  });

  it('supports hour bucket and aligns boundaries by hour', async () => {
    const useCase = new GetExperimentReportUseCaseStub();
    const controller = new ReportController(useCase as unknown as GetExperimentReportUseCase);
    const query = GetExperimentReportQuerySchema.parse({
      from: '2026-02-01T10:12:13.000Z',
      to: '2026-02-01T11:05:59.000Z',
      bucket: 'hour',
    });

    const response = await controller.getExperimentReport('exp-2', query);

    expect(useCase.lastQuery?.bucket).toBe('hour');
    expect(useCase.lastQuery?.from.toISOString()).toBe('2026-02-01T10:00:00.000Z');
    expect(useCase.lastQuery?.to.toISOString()).toBe('2026-02-01T12:00:00.000Z');
    expect(response.bucket).toBe('hour');
  });
});
