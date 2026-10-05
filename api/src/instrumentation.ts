// Must be imported first, before any other import in main.ts, so auto-instrumentation can patch modules before they're required elsewhere.
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME ?? 'api',
  [ATTR_SERVICE_VERSION]: '1.0.0',
  'deployment.environment.name': process.env.DEPLOYMENT_ENVIRONMENT ?? 'demo',
});

// Endpoint comes from OTEL_EXPORTER_OTLP_ENDPOINT; each exporter appends its own /v1/{traces,metrics,logs} suffix.
const sdk = new NodeSDK({
  resource,
  traceExporter: new OTLPTraceExporter(),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter(),
    exportIntervalMillis: 5000,
  }),
  logRecordProcessors: [
    new BatchLogRecordProcessor({ exporter: new OTLPLogExporter() }),
  ],
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
    }),
  ],
});

sdk.start();

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    sdk
      .shutdown()
      .catch((err) => console.error('Error shutting down OTel SDK', err))
      .finally(() => process.exit(0));
  });
}
