import { BroadcastChannel } from 'broadcast-channel'
import { AggregatorRegistry, metric, Registry } from 'prom-client'
import cluster from 'cluster'
import Debug from 'debug'
import { Disposable, disposableTimeout, Emitter, Event, MutableDisposable, toDisposable } from '@newstudios/common'

declare global {
  namespace NodeJS {
    interface Global {
      cluster?: Cluster
    }
  }
}

const instance = Number(process.env.NODE_APP_INSTANCE || '-1') + 1
const debug = Debug(`Prometheus:cluster-${instance}`)

export interface Cmd {
  id: string
  index: number
  targets?: number[]
}

export interface MetricRequest extends Cmd {
  type: 'req_metric'
}

export interface MetricResponse extends Cmd {
  type: 'res_metric'
  metrics: metric[]
}

export interface MsgKeepalive extends Cmd {
  type: 'keepalive'
}

export type Message = MetricRequest | MetricResponse | MsgKeepalive

export interface NodeChanged {
  readonly removed?: readonly number[]
  readonly added?: readonly number[]
}

export default class Cluster extends Disposable {
  private readonly pid = cluster.isMaster ? process.pid : process.ppid
  public readonly name = `cluster-${this.pid}`
  public readonly index = instance

  private _disposed = false
  private readonly registers: Registry[]
  private readonly map = new Map<number, number>()
  private readonly channel = new BroadcastChannel<Message>(this.name, { type: 'node' })
  private readonly mutableTimer = this._register(new MutableDisposable())
  protected readonly _nodeChanged = this._register(new Emitter<NodeChanged>())

  public readonly onNodeChanged = this._nodeChanged.event

  protected readonly onMessage = Event.filter(
    Event.fromDOMEventEmitter<Message>(this.channel, 'message'),
    evt => evt.targets === undefined || evt.targets.includes(this.index)
  )

  public onKeepalive = Event.filter(this.onMessage as Event<MsgKeepalive>, evt => evt.type === 'keepalive')
  public onMetricRequest = Event.filter(this.onMessage as Event<MetricRequest>, evt => evt.type === 'req_metric')
  public onMetricResponse = Event.filter(this.onMessage as Event<MetricResponse>, evt => evt.type === 'res_metric')

  constructor(...registers: Registry[]) {
    super()
    debug('channel name: %s, channel index: %d', this.name, this.index)
    this.registers = registers
    this.onKeepalive(this.handleKeepalive, this)
    this.onMetricRequest(this.handleMetricRequest, this)
    this.onNodeChanged(this.handleNodeChange, this)

    this._register(disposableTimeout(() => this.detect()))
    this._register(toDisposable(() => this.registers.forEach(r => r.clear())))
    this._register(toDisposable(() => this.channel.close()))
    this._register(toDisposable(() => (this._disposed = true)))
  }

  public get count() {
    return this.map.size + 1
  }

  private handleKeepalive({ index: nodeIndex }: MsgKeepalive) {
    if (nodeIndex === this.index) {
      return
    }
    const isNew = !this.map.has(nodeIndex)
    this.map.set(nodeIndex, Date.now())
    if (isNew) {
      debug('channel %d discovers channel %s', this.index, nodeIndex)
      this._nodeChanged.fire({ added: [nodeIndex] })
    }
  }

  private async handleMetricRequest({ id, index }: MetricRequest) {
    const metricsList = await Promise.all(this.registers.map(r => r.getMetricsAsJSON()))
    const metrics = await AggregatorRegistry.aggregate(metricsList).getMetricsAsJSON()
    this.channel.postMessage({
      type: 'res_metric',
      id,
      index: this.index,
      targets: [index],
      metrics,
    })
  }

  private handleNodeChange({ added = [], removed = [] }: NodeChanged) {
    if (added.length) {
      debug(`find other instances UP: ${added.join(', ')}`)
    }
    if (removed.length) {
      debug(`find other instances DOWN: ${removed.join(', ')}`)
    }
  }

  async metrics(...indice: number[]) {
    const metricsList = indice.length ? await this.metricsByNodes(indice) : await this.allMetricsList()
    const register = AggregatorRegistry.aggregate(metricsList)
    return await register.metrics()
  }

  async metricsByNodes(indice: number[]) {
    if (indice.length === 0) {
      return []
    }

    if (indice.includes(this.index)) {
      indice = indice.filter(idx => idx !== this.index)
      const localPromise = Promise.all([...this.registers.map(r => r.getMetricsAsJSON())])
      const remotePromise = this.remoteMetricsList(indice)
      const [remoteMetricsList, localMetricsList] = await Promise.all([remotePromise, localPromise])
      const metricsList = [] as metric[][]
      metricsList.push(...localMetricsList, ...remoteMetricsList)
      return metricsList
    }

    return await this.remoteMetricsList(indice)
  }

  allMetricsList() {
    const indice = [this.index, ...this.map.keys()]
    return this.metricsByNodes(indice)
  }

  private createCmdId(alias = this.index) {
    return `CMD_${alias}_${Math.random()}`
  }

  async remoteMetricsList(targets?: number[]) {
    const size = targets
      ? targets.reduce((sum, t) => {
          return this.map.has(t) ? sum + 1 : sum
        }, 0)
      : this.map.size

    if (size === 0) {
      return []
    }

    const commandId = this.createCmdId()

    process.nextTick(() => {
      if (this._disposed) {
        return
      }
      this.channel.postMessage({ type: 'req_metric', id: commandId, targets, index: this.index })
    })

    return await new Promise<metric[][]>((resolve, reject) => {
      const result = [] as metric[][]
      const onMetricResponse = Event.filter(this.onMetricResponse, data => data.id === commandId)
      const d = onMetricResponse(res => {
        result.push(res.metrics)
        if (result.length >= size) {
          d.dispose()
          resolve(result)
        }
      })
      setTimeout(() => {
        d.dispose()
        reject(new Error('timeout'))
      }, 1000)
    })
  }

  private detectAlive() {
    const { map } = this
    const die = [] as number[]
    const now = Date.now()
    map.forEach((d, i) => {
      if (now - d > 10000) {
        die.push(i)
      }
    })
    die.forEach(i => map.delete(i))
    if (die.length) {
      this._nodeChanged.fire({ removed: die })
    }
  }

  private keepAlive() {
    debug('channel %d broadcast keepalive msg', this.index)
    this.channel.postMessage({
      id: this.createCmdId(),
      type: 'keepalive',
      index: this.index,
    })

    this.mutableTimer.value = disposableTimeout(() => this.detect(), Math.random() * 2000 + 4000)
  }

  private detect() {
    if (this._disposed) return
    this.detectAlive()
    this.keepAlive()
  }
}
