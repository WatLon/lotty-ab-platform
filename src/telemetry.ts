import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getEnv } from '@/shared/infrastructure/config';

const {
  OTEL_EXPORTER_OTLP_ENDPOINT: otlpEndpoint,
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: otlpTracesEndpoint,
} = getEnv();

const traceExporterUrl = otlpTracesEndpoint ?? otlpEndpoint ?? null;

export const telemetryReady: Promise<void> = (() => {
  if (!traceExporterUrl) return Promise.resolve();

  const sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({ url: traceExporterUrl }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
      new PinoInstrumentation(),
    ],
  });

  const shutdown = () => {
    sdk.shutdown().finally(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return Promise.resolve(sdk.start());
})();
