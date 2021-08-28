import { EventEmitter } from 'stream'

interface TaskEvents {
  part: (lastWait: number, part: number) => void
  finish: (parts: number) => void
}

declare interface TaskEmitter {
  on<U extends keyof TaskEvents>(event: U, listener: TaskEvents[U]): this
  emit<U extends keyof TaskEvents>(event: U, ...args: Parameters<TaskEvents[U]>): boolean
}

class TaskEmitter extends EventEmitter {
  public handler: (part: number, parts: number) => Promise<void>
  constructor(
    handler: (part: number, parts: number) => Promise<void>,
    public done: Promise<void>,
    public parts: number = 1
  ) {
    super()
    this.handler = async (lastWait: number, part: number) => {
      await handler(lastWait, part)
      this.emit('part', lastWait, part)
    }
    this.done.then(() => {
      this.emit('finish', parts)
    })
  }

  onPart(action: (lastWait: number, part: number) => void) {
    this.on('part', action)
  }

  onFinish(action: (parts: number) => void) {
    this.on('finish', action)
  }
}

export default TaskEmitter
