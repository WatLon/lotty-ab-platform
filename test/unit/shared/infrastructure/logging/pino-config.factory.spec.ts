import { describe, expect, it } from 'vitest';
import { TypedConfigService } from '@/shared/infrastructure/config';
import { createPinoConfig } from '@/shared/infrastructure/logging/pino-config.factory';

function configFor(nodeEnv: 'development' | 'production'): TypedConfigService {
  return {
    get: (key: string) => {
      if (key === 'NODE_ENV') {
        return nodeEnv;
      }
      throw new Error(`Unexpected key: ${key}`);
    },
  } as unknown as TypedConfigService;
}

describe('createPinoConfig', () => {
  it('builds development config with pretty transport and debug level', () => {
    const config = createPinoConfig(configFor('development'));

    expect(config.pinoHttp.transport).toBeDefined();
    expect(config.pinoHttp.level).toBe('debug');
    expect(config.pinoHttp.base).toEqual({
      service: 'lotty-ab-platform',
      env: 'development',
    });
  });

  it('builds production config without transport and with info level', () => {
    const config = createPinoConfig(configFor('production'));

    expect(config.pinoHttp.transport).toBeUndefined();
    expect(config.pinoHttp.level).toBe('info');
    expect(config.pinoHttp.base).toEqual({
      service: 'lotty-ab-platform',
      env: 'production',
    });
  });

  it('genReqId uses existing request ID header and falls back to generated ID', () => {
    const config = createPinoConfig(configFor('development'));
    const setHeaderCalls: Array<{ key: string; value: string }> = [];
    const response = {
      setHeader: (key: string, value: string) => {
        setHeaderCalls.push({ key, value });
      },
    };

    const requestWithHeader = {
      headers: { 'x-request-id': 'incoming-id' },
    };
    const requestWithoutHeader = {
      headers: {},
    };

    const fromHeader = config.pinoHttp.genReqId(requestWithHeader as never, response as never);
    const generated = config.pinoHttp.genReqId(requestWithoutHeader as never, response as never);

    expect(fromHeader).toBe('incoming-id');
    expect(generated).toBeTruthy();
    expect(setHeaderCalls[0]).toEqual({ key: 'x-request-id', value: 'incoming-id' });
    expect(setHeaderCalls[1]?.key).toBe('x-request-id');
    expect(setHeaderCalls[1]?.value).toBe(generated);
  });

  it('maps customProps from request id and optional user id', () => {
    const config = createPinoConfig(configFor('development'));

    expect(config.pinoHttp.customProps({ id: 123 } as never)).toEqual({
      requestId: '123',
      userId: undefined,
    });

    expect(config.pinoHttp.customProps({ id: 'req-1', user: { id: 'user-1' } } as never)).toEqual({
      requestId: 'req-1',
      userId: 'user-1',
    });
  });
});
