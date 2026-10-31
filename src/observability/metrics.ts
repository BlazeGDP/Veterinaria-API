type MetricLabels = Record<string, string>;

type HistogramState = {
  count: number;
  sum: number;
  buckets: Map<number, number>;
};

const HTTP_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
const httpCounters = new Map<string, { labels: MetricLabels; value: number }>();
const httpHistograms = new Map<string, { labels: MetricLabels; state: HistogramState }>();
const businessCounters = new Map<string, number>();

function escapeLabel(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

function labelsToString(labels: MetricLabels): string {
  return Object.entries(labels)
    .map(([key, value]) => `${key}="${escapeLabel(value)}"`)
    .join(',');
}

function appLabels(): MetricLabels {
  return {
    version: process.env.APP_VERSION || 'local',
    track: process.env.APP_TRACK || 'local',
  };
}

export function recordHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  durationSeconds: number,
): void {
  const labels: MetricLabels = {
    ...appLabels(),
    method: method.toUpperCase(),
    route,
    status_code: String(statusCode),
  };
  const key = labelsToString(labels);
  const current = httpCounters.get(key);
  httpCounters.set(key, { labels, value: (current?.value ?? 0) + 1 });

  const histogramLabels: MetricLabels = {
    ...appLabels(),
    method: method.toUpperCase(),
    route,
  };
  const histogramKey = labelsToString(histogramLabels);
  let histogram = httpHistograms.get(histogramKey);
  if (!histogram) {
    histogram = {
      labels: histogramLabels,
      state: {
        count: 0,
        sum: 0,
        buckets: new Map<number, number>(HTTP_BUCKETS.map((bucket) => [bucket, 0] as [number, number])),
      },
    };
    httpHistograms.set(histogramKey, histogram);
  }

  histogram.state.count += 1;
  histogram.state.sum += durationSeconds;
  for (const bucket of HTTP_BUCKETS) {
    if (durationSeconds <= bucket) {
      histogram.state.buckets.set(bucket, (histogram.state.buckets.get(bucket) ?? 0) + 1);
    }
  }
}

export function recordAppointmentCreated(): void {
  const key = labelsToString(appLabels());
  businessCounters.set(`appointments_created_total|${key}`, (businessCounters.get(`appointments_created_total|${key}`) ?? 0) + 1);
}


export function recordAppointmentListQuery(): void {
  const key = labelsToString(appLabels());
  businessCounters.set(`appointments_list_queries_total|${key}`, (businessCounters.get(`appointments_list_queries_total|${key}`) ?? 0) + 1);
}

export function recordAppointmentSummaryQuery(): void {
  const key = labelsToString(appLabels());
  businessCounters.set(`appointment_summary_queries_total|${key}`, (businessCounters.get(`appointment_summary_queries_total|${key}`) ?? 0) + 1);
}

let previousCpuUsage = process.cpuUsage();
let previousCpuTime = process.hrtime.bigint();

function runtimeMetrics(): string[] {
  const currentCpu = process.cpuUsage();
  const currentTime = process.hrtime.bigint();
  const elapsedSeconds = Number(currentTime - previousCpuTime) / 1_000_000_000;
  const cpuDeltaMicroseconds =
    currentCpu.user - previousCpuUsage.user +
    currentCpu.system - previousCpuUsage.system;

  previousCpuUsage = currentCpu;
  previousCpuTime = currentTime;

  const cpuCores = Math.max(Number(process.env.APP_CPU_CORES || '0.25'), 0.01);
  const memoryLimitBytes = Math.max(Number(process.env.APP_MEMORY_LIMIT_MB || '512'), 64) * 1024 * 1024;
  const memory = process.memoryUsage();
  const cpuSaturation = elapsedSeconds > 0
    ? Math.max(0, (cpuDeltaMicroseconds / 1_000_000) / (elapsedSeconds * cpuCores))
    : 0;
  const memorySaturation = memory.rss / memoryLimitBytes;
  const labels = labelsToString(appLabels());

  return [
    `process_resident_memory_bytes{${labels}} ${memory.rss}`,
    `process_heap_used_bytes{${labels}} ${memory.heapUsed}`,
    `process_cpu_saturation_ratio{${labels}} ${cpuSaturation}`,
    `process_memory_saturation_ratio{${labels}} ${memorySaturation}`,
    `process_cpu_seconds_total{${labels}} ${(currentCpu.user + currentCpu.system) / 1_000_000}`,
    `nodejs_heap_size_used_bytes{${labels}} ${memory.heapUsed}`,
  ];
}

export function renderPrometheusMetrics(): string {
  const lines: string[] = [
    '# HELP http_requests_total Total HTTP requests completed by this API process.',
    '# TYPE http_requests_total counter',
  ];

  for (const metric of httpCounters.values()) {
    lines.push(`http_requests_total{${labelsToString(metric.labels)}} ${metric.value}`);
  }

  lines.push(
    '# HELP http_request_duration_seconds HTTP request duration in seconds.',
    '# TYPE http_request_duration_seconds histogram',
  );

  for (const metric of httpHistograms.values()) {
    for (const bucket of HTTP_BUCKETS) {
      const labels = { ...metric.labels, le: String(bucket) };
      lines.push(`http_request_duration_seconds_bucket{${labelsToString(labels)}} ${metric.state.buckets.get(bucket) ?? 0}`);
    }
    lines.push(`http_request_duration_seconds_bucket{${labelsToString({ ...metric.labels, le: '+Inf' })}} ${metric.state.count}`);
    lines.push(`http_request_duration_seconds_sum{${labelsToString(metric.labels)}} ${metric.state.sum}`);
    lines.push(`http_request_duration_seconds_count{${labelsToString(metric.labels)}} ${metric.state.count}`);
  }

  lines.push(
    '# HELP appointments_created_total Appointments created by this API process.',
    '# TYPE appointments_created_total counter',
    '# HELP appointment_summary_queries_total Canary appointment summary queries.',
    '# TYPE appointment_summary_queries_total counter',
    '# HELP appointments_list_queries_total Appointment list queries by API track.',
    '# TYPE appointments_list_queries_total counter',
  );

  for (const [key, value] of businessCounters.entries()) {
    const [name, labels] = key.split('|');
    lines.push(`${name}{${labels}} ${value}`);
  }

  lines.push(
    '# HELP process_resident_memory_bytes Resident memory used by the Node.js process.',
    '# TYPE process_resident_memory_bytes gauge',
    '# HELP process_cpu_saturation_ratio Process CPU utilization divided by the configured Fargate CPU limit.',
    '# TYPE process_cpu_saturation_ratio gauge',
    '# HELP process_memory_saturation_ratio Process RSS divided by the configured Fargate memory limit.',
    '# TYPE process_memory_saturation_ratio gauge',
  );
  lines.push(...runtimeMetrics());

  return `${lines.join('\n')}\n`;
}
