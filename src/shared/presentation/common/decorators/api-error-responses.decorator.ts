import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { SchemaRegistry, ValidationErrorCode } from '../errors';

interface ApiErrorResponsesOptions {
  badRequest?: boolean | ValidationErrorCode[];
  notFound?: boolean;
  forbidden?: boolean;
  unauthorized?: boolean | string[];
  conflict?: string[];
}

function errorResponse(status: HttpStatus, description: string, codes: string[]) {
  return ApiResponse({
    status,
    description,
    content: { 'application/json': { schema: SchemaRegistry.oneOf(codes) } },
  });
}

export function ApiErrorResponses(options: ApiErrorResponsesOptions = {}) {
  const decorators: MethodDecorator[] = [];
  if (options.badRequest) {
    const codes =
      options.badRequest === true ? Object.values(ValidationErrorCode) : options.badRequest;
    decorators.push(
      ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: 'Validation error',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['code', 'message', 'errors'],
              properties: {
                code: { type: 'string', enum: ['VALIDATION_FAILED'] },
                message: { type: 'string', example: 'Validation failed' },
                errors: { type: 'array', items: SchemaRegistry.oneOf(codes) },
              },
            },
          },
        },
      }),
    );
  }
  if (options.notFound) {
    decorators.push(errorResponse(HttpStatus.NOT_FOUND, 'Resource not found', ['NOT_FOUND']));
  }
  if (options.forbidden) {
    decorators.push(errorResponse(HttpStatus.FORBIDDEN, 'Access forbidden', ['FORBIDDEN']));
  }
  if (options.unauthorized) {
    const codes = options.unauthorized === true ? ['UNAUTHORIZED'] : options.unauthorized;
    decorators.push(errorResponse(HttpStatus.UNAUTHORIZED, 'Access unauthorized', codes));
  }
  if (options.conflict?.length) {
    decorators.push(errorResponse(HttpStatus.CONFLICT, 'Conflict', options.conflict));
  }
  return applyDecorators(...decorators);
}
