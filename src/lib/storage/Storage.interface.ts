import { Readable } from 'stream'
export { Readable } from 'stream'

/**
 * Storage Access Interface
 */
export interface Storage {
  path: string
  get cwd(): string
  status(): Promise<string>
  exists(name?: string): Promise<string | undefined>

  list(): Promise<string[]>

  read(name: string): Promise<Buffer>

  readStream(name: string): Readable

  /* unused writeStream(name: string) */

  add(name: string): Promise<void>
  save(name: string, source: Buffer): Promise<void>

  delete(name: string): Promise<void>
  destroy(): Promise<void>
}
