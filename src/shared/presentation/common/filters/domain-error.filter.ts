import { ArgumentsHost, Catch, ExceptionFilter, Injectable } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { DomainError } from '@/shared/domain/common/errors';
import { domainErrorToHttpStatus } from './domain-error-status';

@Catch(DomainError)
@Injectable()
export class DomainErrorFilter implements ExceptionFilter {
  catch(error: DomainError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<FastifyReply>();
    if (response.sent) return;

    response.code(domainErrorToHttpStatus(error)).send(error.toPlain());
  }
}
