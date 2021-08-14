import TasksContainer from './tasks'
export interface PhotoFileStream {
  id: string
  interval: number
  parts: number
  remaining: number
  handler: (this: PhotoFileStream, lastWait: number) => Promise<void>
}
export default class StreamContainer {
  /**
   * Minimum time gap between handler timings
   */
  static MINIMUM_INTERVAL_SPACING = 1000

  running?: Promise<void>
  runningMS: number = 0

  constructor(public tasks: TasksContainer, public streams: PhotoFileStream[] = []) {}

  get spacing(): number {
    return this.streams.length * StreamContainer.MINIMUM_INTERVAL_SPACING
  }
  get requiredSpacing(): number {
    return (1 + this.streams.length) * StreamContainer.MINIMUM_INTERVAL_SPACING
  }

  get busyWith(): PhotoFileStream[] {
    return this.streams.filter((s) => {
      return s.interval <= this.spacing
    })
  }

  get busy(): boolean {
    return this.busyWith.length > 0
  }

  async run() {
    const sorted = this.streams.sort((a, b) => a.interval - b.interval).slice()
    let s: PhotoFileStream | undefined
    let lastWait = 0
    this.runningMS = 0
    while ((s = sorted.shift())) {
      this.runningMS = s.interval - lastWait
      if (this.runningMS < StreamContainer.MINIMUM_INTERVAL_SPACING) {
        this.runningMS = StreamContainer.MINIMUM_INTERVAL_SPACING
      }
      lastWait = s.interval
      try {
        this.running = this.tasks.createWaitTask(s.id, this.runningMS)
        await this.running
        await s.handler(this.runningMS)
      } catch (error) {
        // mark for deletion
        s.remaining = 1
      }
    }
    this.streams = this.streams.filter((stream) => {
      return --stream.remaining
    })
    if (this.streams.length) {
      // recurse
      await this.run()
    }
  }

  protected add(stream: PhotoFileStream) {
    this.streams.push(stream)
    // TODO adapt this.run()
  }

  create(id: string, interval: number, parts: number = 1, handler = async () => {}) {
    if (this.streams.find((s) => s.id === id)) {
      throw new Error(`Stream [${id}] is already running, did you mean to cancel first?`)
    }
    if (interval <= this.spacing) {
      throw new Error(
        `Stream collision [${id}, ${interval}ms], spacing ${this.requiredSpacing}/${this.spacing}`
      )
    }
    const stream: PhotoFileStream = {
      id,
      interval,
      parts,
      remaining: parts,
      handler,
    }
    this.add(stream)
    return stream
  }
}
