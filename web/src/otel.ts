// Must be imported first in main.tsx, before anything fetches or renders, so instrumentations are wired up in time.
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { UserInteractionInstrumentation } from '@opentelemetry/instrumentation-user-interaction';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ZoneContextManager } from '@opentelemetry/context-zone';
import { MeterProvider, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { logs, SeverityNumber, type AnyValue } from '@opentelemetry/api-logs';
import { trace } from '@opentelemetry/api';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';

const OTLP_ENDPOINT =
  import.meta.env.VITE_OTLP_ENDPOINT ?? 'http://localhost:4318';

const resource = resourceFromAttributes({
  [ATTR_SERVICE_NAME]: 'web',
  [ATTR_SERVICE_VERSION]: '1.0.0',
  'deployment.environment.name': 'demo',
});

const tracerProvider = new WebTracerProvider({
  resource,
  spanProcessors: [
    new BatchSpanProcessor(
      new OTLPTraceExporter({ url: `${OTLP_ENDPOINT}/v1/traces` }),
    ),
  ],
});

tracerProvider.register({ contextManager: new ZoneContextManager() });

registerInstrumentations({
  tracerProvider,
  instrumentations: [
    new DocumentLoadInstrumentation(),
    new UserInteractionInstrumentation({ eventNames: ['click', 'submit'] }),
    new FetchInstrumentation({
      // Propagate traceparent on same-origin calls to link web -> api traces.
      propagateTraceHeaderCorsUrls: [/.*/],
      clearTimingResources: true,
    }),
  ],
});

export const tracer = trace.getTracer('web.ui');

const meterProvider = new MeterProvider({
  resource,
  readers: [
    new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${OTLP_ENDPOINT}/v1/metrics` }),
      exportIntervalMillis: 5000,
    }),
  ],
});

const meter = meterProvider.getMeter('web.ui');

const cartAddCounter = meter.createCounter('web.cart.add', {
  description: 'Number of "add to cart" clicks',
});
export function recordCartAdd() {
  cartAddCounter.add(1);
}

const loggerProvider = new LoggerProvider({
  resource,
  processors: [
    new BatchLogRecordProcessor({
      exporter: new OTLPLogExporter({ url: `${OTLP_ENDPOINT}/v1/logs` }),
    }),
  ],
});
logs.setGlobalLoggerProvider(loggerProvider);

const otelLogger = logs.getLogger('web.ui');

export const log = {
  info: (message: string, attributes: Record<string, AnyValue> = {}) =>
    otelLogger.emit({
      severityNumber: SeverityNumber.INFO,
      severityText: 'INFO',
      body: message,
      attributes,
    }),
  warn: (message: string, attributes: Record<string, AnyValue> = {}) =>
    otelLogger.emit({
      severityNumber: SeverityNumber.WARN,
      severityText: 'WARN',
      body: message,
      attributes,
    }),
  error: (message: string, attributes: Record<string, AnyValue> = {}) =>
    otelLogger.emit({
      severityNumber: SeverityNumber.ERROR,
      severityText: 'ERROR',
      body: message,
      attributes,
    }),
};
