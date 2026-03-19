import { randomUUID } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';
import { TypedConfigService } from '@/shared/infrastructure/config';

export function createPinoConfig(config: TypedConfigService) {
  const isProd = config.get('NODE_ENV') === 'production';
  return {
    pinoHttp: {
      transport: isProd
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              singleLine: true,
              colorize: true,
              translateTime: 'SYS:standard',
            },
          },
      level: isProd ? 'info' : 'debug',
      autoLogging: false,
      genReqId: (request: IncomingMessage, response: ServerResponse) => {
        const header = request.headers['x-request-id'];
        const requestId = (Array.isArray(header) ? header[0] : header) || randomUUID();
        response.setHeader('x-request-id', requestId);
        return requestId;
      },
      customProps: (
        request: IncomingMessage & {
          id?: string | number;
          user?: { id?: string };
        },
      ) => ({
        requestId: request.id?.toString(),
        userId: request.user?.id,
      }),
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-api-key"]',
          'req.body.password',
          'req.body.token',
          'req.body.accessToken',
          'req.body.refreshToken',
          'req.query.token',
          'req.query.accessToken',
          'req.query.refreshToken',
          'res.headers["set-cookie"]',
        ],
        censor: '[REDACTED]',
      },
      serializers: {
        req: () => undefined,
      },
      formatters: { level: (label: string) => ({ level: label }) },
      base: {
        service: 'lotty-ab-platform',
        env: config.get('NODE_ENV'),
      },
    },
  };
}
