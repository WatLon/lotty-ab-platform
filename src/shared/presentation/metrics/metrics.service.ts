import { Injectable } from '@nestjs/common';
import { Counter, collectDefaultMetrics, Gauge, Histogram, Registry } from 'prom-client';

export const METRIC_HTTP_REQUESTS_TOTAL = 'http_requests_total';
export const METRIC_LOTTY_DECIDE_TOTAL = 'lotty_decide_total';
export const METRIC_LOTTY_INGEST_TOTAL = 'lotty_ingest_total';
export const METRIC_LOTTY_DECIDE_DURATION_MS = 'lotty_decide_duration_ms';
export const METRIC_LOTTY_ACTIVE_EXPERIMENTS = 'lotty_active_experiments';

const DEFAULT_DURATION_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

type GaugeSupplier = () => number | Promise<number>;

@Injectable()
export class MetricsService {
  private readonly registry = new Registry();

  private readonly counters = new Map<string, Counter>();

  private readonly histograms = new Map<string, Histogram>();

  private readonly gauges = new Map<string, Gauge>();

  private readonly gaugeSuppliers = new Map<string, GaugeSupplier>();
  private readonly httpCounter: Counter;

  constructor() {
    collectDefaultMetrics({ register: this.registry });

    this.httpCounter = new Counter({
      name: METRIC_HTTP_REQUESTS_TOTAL,
      help: 'Total HTTP requests',
      labelNames: ['method', 'path', 'status'] as const,
      registers: [this.registry],
    });

    this.ensureCounter(METRIC_LOTTY_DECIDE_TOTAL, 'Total decide requests');
    this.ensureCounter(METRIC_LOTTY_INGEST_TOTAL, 'Total ingested events');
    this.ensureHistogram(METRIC_LOTTY_DECIDE_DURATION_MS, 'Decide latency in ms');
    this.ensureGauge(METRIC_LOTTY_ACTIVE_EXPERIMENTS, 'Active experiments (RUNNING + PAUSED)');
  }

  increment(name: string, delta = 1): void {
    if (!Number.isFinite(delta)) return;

    this.ensureCounter(name, name).inc(delta);
  }

  incrementHttp(method: string, path: string, statusCode: number): void {
    this.httpCounter.inc({ method, path, status: String(statusCode) });
  }

  observeHistogram(name: string, value: number): void {
    if (!Number.isFinite(value)) return;

    this.ensureHistogram(name, name).observe(value);
  }

  setGauge(name: string, value: number): void {
    if (!Number.isFinite(value)) return;

    this.ensureGauge(name, name).set(value);
  }

  registerGaugeSupplier(name: string, supplier: GaugeSupplier): void {
    this.gaugeSuppliers.set(name, supplier);
  }

  async renderPrometheus(): Promise<string> {
    await this.refreshSuppliedGauges();
    return this.registry.metrics();
  }

  private ensureCounter(name: string, help: string): Counter {
    let counter = this.counters.get(name);
    if (!counter) {
      counter = new Counter({ name, help, registers: [this.registry] });
      this.counters.set(name, counter);
    }
    return counter;
  }

  private ensureHistogram(name: string, help: string): Histogram {
    let histogram = this.histograms.get(name);
    if (!histogram) {
      histogram = new Histogram({
        name,
        help,
        buckets: [...DEFAULT_DURATION_BUCKETS_MS],
        registers: [this.registry],
      });
      this.histograms.set(name, histogram);
    }
    return histogram;
  }

  private ensureGauge(name: string, help: string): Gauge {
    let gauge = this.gauges.get(name);
    if (!gauge) {
      gauge = new Gauge({ name, help, registers: [this.registry] });
      this.gauges.set(name, gauge);
    }
    return gauge;
  }

  private async refreshSuppliedGauges(): Promise<void> {
    for (const [name, supplier] of this.gaugeSuppliers.entries()) {
      try {
        const value = await supplier();
        if (Number.isFinite(value)) this.setGauge(name, value);
      } catch {}
    }
  }
}
