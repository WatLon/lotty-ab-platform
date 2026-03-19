import {
  METRIC_LOTTY_ACTIVE_EXPERIMENTS,
  METRIC_LOTTY_DECIDE_DURATION_MS,
  MetricsService,
} from '@/shared/presentation/metrics/metrics.service';

describe('MetricsService', () => {
  it('renders required counters, histogram and gauge by default', async () => {
    const service = new MetricsService();

    const rendered = await service.renderPrometheus();

    expect(rendered).toContain('# TYPE http_requests_total counter');
    expect(rendered).toContain('lotty_decide_total 0');
    expect(rendered).toContain('lotty_ingest_total 0');
    expect(rendered).toContain('# TYPE lotty_decide_duration_ms histogram');
    expect(rendered).toContain('lotty_decide_duration_ms_count 0');
    expect(rendered).toContain('lotty_active_experiments 0');

    expect(rendered).toContain('process_cpu_');
  });

  it('records histogram observations and refreshes gauge from supplier', async () => {
    const service = new MetricsService();
    service.observeHistogram(METRIC_LOTTY_DECIDE_DURATION_MS, 8);
    service.observeHistogram(METRIC_LOTTY_DECIDE_DURATION_MS, 42);
    service.registerGaugeSupplier(METRIC_LOTTY_ACTIVE_EXPERIMENTS, async () => 3);

    const rendered = await service.renderPrometheus();

    expect(rendered).toContain('lotty_decide_duration_ms_bucket{le="10"} 1');
    expect(rendered).toContain('lotty_decide_duration_ms_bucket{le="50"} 2');
    expect(rendered).toContain('lotty_decide_duration_ms_count 2');
    expect(rendered).toContain('lotty_decide_duration_ms_sum 50');
    expect(rendered).toContain('lotty_active_experiments 3');
  });
});
