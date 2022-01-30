import { Readable } from 'stream'

/**
 * Storage Access Interface
 */
export interface Storage {
  status(): Promise<string>

  get cwd(): string
  exists(name?: string): Promise<boolean>

  list(): Promise<string[]>

  read(name: string): Promise<Buffer>

  readStream(name: string): Readable

  /* unused writeStream(name: string) */

  save(name: string, source: Buffer): Promise<void>

  delete(name: string): Promise<void>
}
