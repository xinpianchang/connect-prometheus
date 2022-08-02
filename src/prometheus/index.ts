import { Metric, Registry } from 'prom-client'
import { currentClusterGauge } from './metrics/cluster'
import Cluster from './cluster'

const clusterRegister = new Registry()
const aggregatorRegister = new Registry()
const singleRegister = new Registry()

// collect metrics only belong to the current cluster
registerMetrics(singleRegister, currentClusterGauge)

export interface MetricsInit {
  clusterMetrics?: Metric<string>[]
  aggregatorMetrics?: Metric<string>[]
}

export function initPrometheus({ clusterMetrics = [], aggregatorMetrics = [] }: MetricsInit) {
  global.cluster?.dispose()
  global.cluster = new Cluster(aggregatorRegister, clusterRegister)
  const cluster = global.cluster
  clusterRegister.setDefaultLabels({ node: String(cluster.index) })

  registerMetrics(clusterRegister, ...clusterMetrics)
  registerMetrics(aggregatorRegister, ...aggregatorMetrics)
}

function registerMetrics(register: Registry, ...metrics: Metric<string>[]) {
  metrics.forEach(m => register.registerMetric(m))
}

export async function getMetrics(indice: number[]) {
  const cluster = global.cluster
  if (cluster) {
    const [single, multiple] = await Promise.all([singleRegister.metrics(), cluster.metrics(...indice)])
    return `${single}\n${multiple}`
  }
  return await singleRegister.metrics()
}
