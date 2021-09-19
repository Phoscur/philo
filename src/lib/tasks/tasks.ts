export interface Task {
  id: string
  abort(): Promise<void>
}

export class TasksContainer {
  static setTimeout = setTimeout
  static clearTimeout = clearTimeout
  running: { [id: string]: Task }

  constructor(protected logger = console.log) {
    this.running = {}
  }

  ongoing(id: string) {
    return this.running[id]
  }

  createWaitTask(id: string, wait: number): Promise<void> {
    if (this.ongoing(id)) {
      throw new Error(`An ongoing Task [${id}] already exists!`)
    }
    return new Promise<void>((resolve, reject) => {
      const timeout = TasksContainer.setTimeout(resolve, wait)
      this.running[id] = {
        id,
        abort: async () => {
          TasksContainer.clearTimeout(timeout)
          this.logger(`Task [${id}] aborted, its wait time was ${wait}ms`)
          reject('Aborted: ' + id)
        },
      }
      this.logger(`Task [${id}] running for ${wait}ms`)
    }).finally(() => {
      delete this.running[id]
    })
  }

  async cancel(id: string) {
    if (!this.ongoing(id)) {
      return
    }
    const task = this.running[id]
    delete this.running[id]
    return task.abort()
  }
}
