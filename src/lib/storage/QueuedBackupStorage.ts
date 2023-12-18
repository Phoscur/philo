import { FileStorage } from './FileStorage'

/**
 * Running backups while taking a time lapse may interfere with the camera task scheduler.
 */
export abstract class QueuedBackupStorage extends FileStorage {
  static DELAY_MS = 3000
  private queue: string[] = []
  private processing: boolean = false

  get queueStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
    }
  }

  protected enqueue(fileName: string) {
    this.queue.push(fileName)
  }

  async save(fileName: string, source: Buffer) {
    await super.save(fileName, source)
    this.enqueue(fileName)
  }

  abstract add(fileName: string): Promise<void>

  async processQueue() {
    this.processing = true
    while (this.queue.length > 0) {
      const fileName = this.queue[0]
      try {
        await this.add(fileName)
        const delayMS = (this.constructor as typeof QueuedBackupStorage).DELAY_MS
        await new Promise((resolve) => setTimeout(resolve, delayMS))
      } catch (error) {
        console.error('Failed to backup! Queue length:', this.queue.length, error)
      }
      this.queue.shift()
    }
    this.processing = false
  }
}
