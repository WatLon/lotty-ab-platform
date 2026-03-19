import 'dotenv/config';
import { Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';
import { Logger } from 'nestjs-pino';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppLogger } from '@/shared/application';
import { getEnv } from '@/shared/infrastructure/config';
import '@/shared/presentation/common/errors';
import { SchemaRegistry } from '@/shared/presentation/common/errors/schema-registry';

interface BootstrapHttpAppOptions {
  rootModule: Type<unknown>;
  serviceName: string;
  docsEnabled?: boolean;
}

type JsonObject = { [key: string]: unknown };

const OPENAPI_SCHEMA_REF_PREFIX = '#/components/schemas/';

function shouldEnableSwagger(docsEnabled: boolean): boolean {
  return docsEnabled;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function collectSchemaRefs(
  value: unknown,
  refs: Set<string>,
  options?: {
    skipComponentsSchemas?: boolean;
    path?: string[];
  },
): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectSchemaRefs(item, refs, options);
    }
    return;
  }

  if (!isJsonObject(value)) {
    return;
  }

  const path = options?.path ?? [];
  if (
    options?.skipComponentsSchemas &&
    path.length === 2 &&
    path[0] === 'components' &&
    path[1] === 'schemas'
  ) {
    return;
  }

  const refValue = value.$ref;
  if (typeof refValue === 'string' && refValue.startsWith(OPENAPI_SCHEMA_REF_PREFIX)) {
    refs.add(refValue.slice(OPENAPI_SCHEMA_REF_PREFIX.length));
  }

  for (const [key, nestedValue] of Object.entries(value)) {
    collectSchemaRefs(nestedValue, refs, {
      ...options,
      path: [...path, key],
    });
  }
}

function pruneUnusedSchemas<T extends JsonObject>(document: T): T {
  if (!isJsonObject(document.components)) {
    return document;
  }

  const components = document.components;
  if (!isJsonObject(components.schemas)) {
    return document;
  }

  const schemas = components.schemas;
  const reachableSchemaNames = new Set<string>();

  collectSchemaRefs(document, reachableSchemaNames, {
    skipComponentsSchemas: true,
  });

  const queue = [...reachableSchemaNames];
  while (queue.length > 0) {
    const schemaName = queue.pop();
    if (!schemaName) continue;

    const schema = schemas[schemaName];
    if (schema === undefined) continue;

    const nestedRefs = new Set<string>();
    collectSchemaRefs(schema, nestedRefs);
    for (const nestedRef of nestedRefs) {
      if (reachableSchemaNames.has(nestedRef)) continue;

      reachableSchemaNames.add(nestedRef);
      queue.push(nestedRef);
    }
  }

  const prunedSchemas = Object.fromEntries(
    Object.entries(schemas).filter(([schemaName]) => reachableSchemaNames.has(schemaName)),
  );
  components.schemas = prunedSchemas;

  return document;
}

export async function bootstrapHttpApp(options: BootstrapHttpAppOptions): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    options.rootModule,
    new FastifyAdapter(),
    { bufferLogs: true },
  );
  const logger = app.get(Logger);
  const appLogger = app.get(AppLogger);
  app.useLogger(logger);
  const enableSwagger = shouldEnableSwagger(options.docsEnabled ?? true);
  if (enableSwagger) {
    try {
      const config = new DocumentBuilder()
        .setTitle('LOTTY A/B Platform')
        .setVersion('1.0')
        .setLicense(
          'UNLICENSED',
          'https://docs.npmjs.com/cli/v11/configuring-npm/package-json#license',
        )
        .addServer('/')
        .addBearerAuth(
          {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Access token from /auth/login',
          },
          'access-token',
        )
        .addSecurityRequirements('access-token')
        .setOpenAPIVersion('3.1.0')
        .build();
      const document = SwaggerModule.createDocument(app, config);
      document.components = document.components || {};
      document.components.schemas = document.components.schemas || {};
      for (const [code, schema] of Object.entries(SchemaRegistry.getAll())) {
        document.components.schemas[`${code}Error`] = schema;
      }
      const cleanedDocument = cleanupOpenApiDoc(document, { version: '3.1' });
      const finalDocument = pruneUnusedSchemas(cleanedDocument as unknown as JsonObject);
      app.getHttpAdapter().get(
        '/openapi.json',
        (
          _req: unknown,
          reply: {
            send: (body: unknown) => void;
          },
        ) => {
          reply.send(finalDocument);
        },
      );
      app.use(
        '/docs',
        apiReference({
          content: finalDocument,
          theme: 'kepler',
          withFastify: true,
        }),
      );
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      appLogger.warn(
        {
          event: 'system.swagger.disabled_due_to_bootstrap_error',
          domain: 'system',
          operation: 'bootstrap',
          status: 'failure',
          meta: {
            serviceName: options.serviceName,
            errorMessage,
            errorStack,
          },
        },
        'swagger bootstrap failed, continuing without docs',
      );
      logger.warn({ error }, 'swagger bootstrap failed');
    }
  }
  const { PORT: port } = getEnv();
  await app.listen(port, '0.0.0.0');
  appLogger.info(
    {
      event: 'system.application.started',
      domain: 'system',
      operation: 'bootstrap',
      status: 'success',
      meta: {
        serviceName: options.serviceName,
        port,
        docsPath: enableSwagger ? '/docs' : null,
        openApiJsonPath: enableSwagger ? '/openapi.json' : null,
      },
    },
    'application started',
  );
}
