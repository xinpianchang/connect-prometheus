import { Gauge } from 'prom-client'

export const clusterNumberGauge = new Gauge({
  name: 'nodejs_cluster_total',
  help: 'The quatity of alive clusters',
  aggregator: 'min',
  registers: [],
  collect() {
    this.set(global.cluster?.count || 0)
  },
})

export const currentClusterGauge = new Gauge({
  name: 'current_cluster',
  help: 'Current cluster index',
  aggregator: 'first',
  registers: [],
  collect() {
    this.set(global.cluster?.index ?? 0)
  },
})
