import { IncomingMessage, ServerResponse } from 'http'
import { Counter, Gauge, Histogram, Aggregator } from 'prom-client'

type MetricBase = {
  name: string
  help: string
  labelNames?: readonly string[]
  aggregator?: Aggregator
}

export type MetricOption =
  | ({
      type: 'counter' | 'gauge'
    } & MetricBase)
  | ({
      type: 'histogram'
      buckets: number[]
    } & MetricBase)
  | ({
      type: 'summary'
      percentiles?: number[]
      maxAgeSeconds?: number
      ageBuckets?: number
      compressCount?: number
    } & MetricBase)

export interface PrometheusOptions {
  metrics?: MetricOption[]
}

declare module 'http' {
  interface IncomingMessage {
    getMetrics?: typeof getMetrics
  }
}

declare module 'prom-client' {
  interface Gauge<T extends string> {
    aggregator: Aggregator
  }
}

export interface DefaultMetricsMap {
  process_cpu_user_seconds_total: Counter<string>
  process_cpu_system_seconds_total: Counter<string>
  process_cpu_seconds_total: Counter<string>
  process_resident_memory_bytes: Gauge<string>
  process_start_time_seconds: Gauge<string>
  nodejs_eventloop_lag_seconds: Gauge<string>
  nodejs_eventloop_lag_min_seconds: Gauge<string>
  nodejs_eventloop_lag_max_seconds: Gauge<string>
  nodejs_eventloop_lag_mean_seconds: Gauge<string>
  nodejs_eventloop_lag_stddev_seconds: Gauge<string>
  nodejs_eventloop_lag_p50_seconds: Gauge<string>
  nodejs_eventloop_lag_p90_seconds: Gauge<string>
  nodejs_eventloop_lag_p99_seconds: Gauge<string>
  nodejs_active_handles: Gauge<string>
  nodejs_active_handles_total: Gauge<string>
  nodejs_active_requests: Gauge<string>
  nodejs_active_requests_total: Gauge<string>
  nodejs_heap_size_total_bytes: Gauge<string>
  nodejs_heap_size_used_bytes: Gauge<string>
  nodejs_external_memory_bytes: Gauge<string>
  nodejs_heap_space_size_total_bytes: Gauge<string>
  nodejs_heap_space_size_used_bytes: Gauge<string>
  nodejs_heap_space_size_available_bytes: Gauge<string>
  nodejs_version_info: Gauge<string>
  nodejs_gc_duration_seconds: Histogram<string>
  process_max_fds?: Gauge<string>
  process_open_fds?: Gauge<string>
}

export = (options?: PrometheusOptions) => (req: IncomingMessage, res: ServerResponse, next: () => any) => any
