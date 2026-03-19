import 'reflect-metadata';

process.env.NODE_ENV ??= 'test';
process.env.APP_SECRET ??= 'test-app-secret';

if (typeof Reflect.getMetadata !== 'function') {
  throw new Error('reflect-metadata is not initialized in Vitest runtime');
}
