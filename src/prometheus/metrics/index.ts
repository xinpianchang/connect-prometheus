import { collectDefaultMetrics, Registry } from 'prom-client'
import type { DefaultMetricsMap } from '../../..'

export function getDefaultMetricsMap() {
  const register = new Registry() as any
  collectDefaultMetrics({ register })
  const map = register._metrics as DefaultMetricsMap
  register.clear()

  map.process_start_time_seconds.aggregator = 'first'
  map.nodejs_eventloop_lag_min_seconds.aggregator = 'min'
  map.nodejs_eventloop_lag_max_seconds.aggregator = 'max'

  return map
}
