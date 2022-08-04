import { IncomingMessage, ServerResponse } from 'http'
import onFinished from 'on-finished'
import { Metric, Counter, Gauge, Histogram, Summary } from 'prom-client'
import { PrometheusOptions } from '..'
import { initPrometheus, getMetrics } from './prometheus'
import { getDefaultMetricsMap } from './prometheus/metrics'
import { clusterNumberGauge } from './prometheus/metrics/cluster'
import {
  httpRequestDurationHistogram,
  httpRequestCounter,
  httpRequestStatusCounter,
  httpOutboundCounter,
} from './prometheus/metrics/http'

export default function Prometheus({ metrics = [] }: PrometheusOptions = {}) {
  // collect metrics on default register
  const map = getDefaultMetricsMap()

  const clusterMetrics = ([
    map.process_start_time_seconds,
    map.process_resident_memory_bytes,
    map.process_open_fds,
    map.process_max_fds,
    map.process_cpu_seconds_total,
    map.process_cpu_user_seconds_total,
    map.process_cpu_system_seconds_total,
    map.nodejs_version_info,
    map.nodejs_heap_size_used_bytes,
    map.nodejs_heap_size_total_bytes,
    map.nodejs_eventloop_lag_stddev_seconds,
    map.nodejs_eventloop_lag_p50_seconds,
    map.nodejs_eventloop_lag_p90_seconds,
    map.nodejs_eventloop_lag_p99_seconds,
    map.nodejs_eventloop_lag_mean_seconds,
  ].filter(Boolean) as unknown) as Metric<string>[]

  // collect metrics on aggregator register
  const aggregatorMetrics = ([
    map.nodejs_heap_space_size_used_bytes,
    map.nodejs_heap_space_size_available_bytes,
    map.nodejs_heap_space_size_total_bytes,
    map.nodejs_gc_duration_seconds,
    map.nodejs_external_memory_bytes,
    map.nodejs_eventloop_lag_seconds,
    map.nodejs_eventloop_lag_min_seconds,
    map.nodejs_eventloop_lag_max_seconds,
    map.nodejs_active_requests,
    map.nodejs_active_requests_total,
    map.nodejs_active_handles,
    map.nodejs_active_handles_total,
    httpRequestStatusCounter,
    httpRequestCounter,
    httpRequestDurationHistogram,
    httpOutboundCounter,
    clusterNumberGauge,
  ].filter(Boolean) as unknown) as Metric<string>[]

  metrics.forEach(m => {
    const { type, aggregator } = m
    let metric: Metric<string>
    switch (type) {
      case 'counter': {
        metric = new Counter(m)
        break
      }
      case 'gauge': {
        metric = new Gauge(m)
        break
      }
      case 'histogram': {
        metric = new Histogram(m)
        break
      }
      case 'summary': {
        metric = new Summary(m)
        break
      }
    }
    if (aggregator) {
      aggregatorMetrics.push(metric)
    } else {
      clusterMetrics.push(metric)
    }
  })

  initPrometheus({ clusterMetrics, aggregatorMetrics })

  return function middleware(req: IncomingMessage, res: ServerResponse, next: () => any) {
    req.getMetrics = getMetrics

    httpRequestCounter.inc()
    const begin = process.hrtime()
    onFinished(res, () => {
      const [seconds, nano] = process.hrtime(begin)
      const durationMs = seconds * 1e3 + nano * 1e-6
      httpRequestDurationHistogram.observe(durationMs * 1e-3)
      if (res.statusCode) {
        httpRequestStatusCounter.inc({ status: String(res.statusCode) })
      }
      const length = res.getHeader('content-length') || '0'
      httpOutboundCounter.inc(Number(length))
    })

    next()
  }
}
