import { TasksContainer } from './tasks'
import { TaskEmitter } from './TaskEmitter'

export interface TaskStream {
  id: string
  due: number
  interval: number
  parts: number
  remaining: number
  handler: (this: TaskStream, lastWait: number, part: number) => Promise<void>
}
export class StreamContainer {
  /**
   * Minimum time gap between handler timings
   */
  static MINIMUM_INTERVAL_SPACING = 2000

  running?: Promise<void>

  constructor(
    public tasks: TasksContainer,
    public streams: TaskStream[] = [],
    public now: number = Date.now()
  ) {}

  get spacing(): number {
    return this.streams.length * StreamContainer.MINIMUM_INTERVAL_SPACING
  }
  get requiredSpacing(): number {
    return (1 + this.streams.length) * StreamContainer.MINIMUM_INTERVAL_SPACING
  }
  get smallestInterval(): number {
    return this.streams.reduce(
      (smallest, { interval }) => (smallest <= interval ? smallest : interval),
      Number.POSITIVE_INFINITY
    )
  }

  nextSpace(dueMS: number): number {
    if (!this.streams.length) return 0
    let space = 0
    let conflicts
    do {
      conflicts = this.streams.filter((s) => dueMS + space <= s.due)
      if (conflicts.length) space += StreamContainer.MINIMUM_INTERVAL_SPACING
    } while (conflicts.length)
    return space
  }

  get busyWith(): TaskStream[] {
    return this.streams.filter((s) => {
      return s.interval <= this.spacing
    })
  }

  get busy(): boolean {
    return this.busyWith.length > 0
  }

  async run() {
    this.now = Date.now()
    // TODO wait for running tasks to finish here? - should call this method "drain" then
    this.streams = this.streams.filter((s) => s.remaining)
  }

  protected handleTask(stream: TaskStream, wait: number) {
    // execute all the stream handlers
    const handler: () => Promise<void> = async () => {
      await stream.handler(wait, stream.parts + 1 - stream.remaining)
      // console.log('Stream Countdown:', stream.remaining)
      if (!--stream.remaining) return
      wait = stream.interval
      await this.tasks.createWaitTask(stream.id, wait)
      await handler()
    }
    return handler
  }

  createPartEmitter(
    id: string,
    partHandler: (part: number) => Promise<void>,
    finishHandler: (parts: number) => Promise<void> = async () => {},
    parts: number = 1,
    interval: number = 0,
    due = Date.now()
  ): TaskEmitter {
    const stream = this.create(id, due, parts, interval, (_, part) => partHandler(part))
    const emitter = this.addStream(stream)
    //emitter.onPart((_, part) => partHandler(part))
    emitter.onFinish(finishHandler)
    return emitter
  }

  async add(stream: TaskStream) {
    this.streams = this.streams.filter((s) => s.remaining)
    const spacing = this.nextSpace(stream.due)
    stream.due += spacing
    this.streams.push(stream)
    const wait = stream.due - this.now
    const initialWait = wait < 0 ? 0 : wait
    if (initialWait !== 0) {
      console.log(`Adding Stream with initial wait ${initialWait}ms`)
    }
    return this.tasks
      .createWaitTask(stream.id, initialWait)
      .then(this.handleTask(stream, initialWait))
      .catch(() => {
        // mark for deletion
        stream.remaining = 0
      })
  }

  addStream(stream: TaskStream): TaskEmitter {
    const handler = stream.handler.bind(stream)
    const done = this.add(stream)
    const emitter = new TaskEmitter(handler, done, stream.parts)
    // overwrite with emitter-wrapped handler
    stream.handler = emitter.handler
    return emitter
  }

  create(
    id: string,
    due = Date.now(),
    parts: number = 1,
    interval: number = 0,
    handler: (this: TaskStream, lastWait: number, part: number) => Promise<void> = async () => {}
  ) {
    if (this.streams.find((s) => s.id === id)) {
      throw new Error(`Stream [${id}] is already running, did you mean to cancel first?`)
    }
    if (interval && interval <= this.spacing) {
      throw new Error(
        `Stream collision [${id}, ${interval}ms], spacing ${this.requiredSpacing}/${this.spacing}`
      )
    }
    const smallestInterval = this.smallestInterval
    if (
      // a short or multiple intervals might not allow more than the same
      smallestInterval < this.spacing ||
      (smallestInterval <= this.requiredSpacing && smallestInterval !== interval)
    ) {
      throw new Error(
        `Stream collision [${id}, ${interval}ms], spacing is ${StreamContainer.MINIMUM_INTERVAL_SPACING} for ${this.streams.length}x${smallestInterval}`
      )
    }
    if (smallestInterval < Number.POSITIVE_INFINITY && smallestInterval % interval !== 0) {
      throw new Error(
        `Stream collision [${id}, ${interval}ms], interval is locked to modulo ${smallestInterval}`
      )
    }
    const stream: TaskStream = {
      id,
      due,
      interval,
      parts,
      remaining: parts,
      handler,
    }
    return stream
  }

  cancel(id: string) {
    this.tasks.cancel(id)
    this.streams = this.streams.filter((s) => s.id !== id)
  }
}
