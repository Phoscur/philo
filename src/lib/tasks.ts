export interface Task {
  id: string
  abort(): Promise<void>
}

export default class TasksContainer {
  running: { [id: string]: Task }

  constructor() {
    this.running = {}
  }

  ongoing(id: string) {
    return this.running[id]
  }

  createWaitTask(id: string, wait: number): Promise<void> {
    if (this.ongoing(id)) {
      throw new Error(`An ongoing Task with ID[${id}] already exists!`)
    }
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(resolve, wait)
      this.running[id] = {
        id,
        abort: async () => {
          clearTimeout(timeout)
          reject('Aborted: ' + id)
        },
      }
      console.log(`Task ${id} running for ${wait}ms`)
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
