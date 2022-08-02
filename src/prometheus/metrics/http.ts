import { Histogram, Counter } from 'prom-client'

export const httpRequestDurationHistogram = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  buckets: [0.05, 0.1, 0.2, 0.4, 0.8, 1.5, 3, 6, 10],
  aggregator: 'sum',
  registers: [],
})

export const httpRequestCounter = new Counter({
  name: 'http_request_total',
  help: 'The total http requests',
  aggregator: 'sum',
  registers: [],
})

export const httpOutboundCounter = new Counter({
  name: 'http_outbound_bytes_total',
  help: 'The total outbound bytes for http response',
  aggregator: 'sum',
  registers: [],
})

export const httpRequestStatusCounter = new Counter({
  name: 'http_request_status',
  help: 'The response status statistics',
  labelNames: ['status'],
  aggregator: 'sum',
  registers: [],
})
