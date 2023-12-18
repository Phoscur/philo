import { Readable } from 'stream'
export { Readable } from 'stream'

/**
 * Storage Access Interface
 */
export interface Storage {
  path: string
  /**
   * GlacierStorage uses this field to give access to the vault name
   */
  get name(): string
  get cwd(): string
  status(): Promise<string>
  exists(name?: string): Promise<string | undefined>

  list(): Promise<string[]>

  read(name: string): Promise<Buffer>

  readStream(name: string): Readable

  /* unused writeStream(name: string) */

  save(name: string, source: Buffer): Promise<void>
  add(name: string): Promise<void>
  processQueue(): Promise<void>

  delete(name: string): Promise<void>
  destroy(): Promise<void>
}
