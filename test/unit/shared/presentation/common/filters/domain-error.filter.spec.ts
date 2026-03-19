import { ArgumentsHost } from '@nestjs/common';
import { UserId } from '@/apps/control-api/domain/user/user.id';
import {
  BusinessRuleError,
  ConcurrencyError,
  DomainError,
  ForbiddenError,
  NotFoundError,
  RequiredError,
  ValidationErrors,
} from '@/shared/domain/common';
import { DomainErrorFilter } from '@/shared/presentation/common/filters/domain-error.filter';

function createHost(request: Record<string, unknown>) {
  let statusCode: number | undefined;
  let body: unknown;

  const response = {
    code: (status: number) => {
      statusCode = status;
      return response;
    },
    send: (payload: unknown) => {
      body = payload;
      return response;
    },
  };

  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return { host, getStatusCode: () => statusCode, getBody: () => body };
}

describe('DomainErrorFilter', () => {
  it('maps domain errors to expected status codes', () => {
    const filter = new DomainErrorFilter();

    const cases: Array<{ error: DomainError; expectedStatus: number }> = [
      { error: new ValidationErrors([new RequiredError('name')]), expectedStatus: 400 },
      { error: new RequiredError('name'), expectedStatus: 400 },
      { error: new NotFoundError('user', UserId.generate()), expectedStatus: 404 },
      { error: new ForbiddenError('user', UserId.generate()), expectedStatus: 403 },
      { error: new ConcurrencyError('user', UserId.generate()), expectedStatus: 409 },
      {
        error: new (class extends BusinessRuleError {
          readonly code = 'CUSTOM_CONFLICT';

          constructor() {
            super('custom business rule');
          }
        })(),
        expectedStatus: 409,
      },
    ];

    for (const testCase of cases) {
      const scope = createHost({});
      filter.catch(testCase.error, scope.host);
      expect(scope.getStatusCode()).toBe(testCase.expectedStatus);
      expect(scope.getBody()).toEqual(testCase.error.toPlain());
    }
  });
});
