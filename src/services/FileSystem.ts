import { join } from 'path'
import { stat, mkdir, readdir, readFile, writeFile, unlink, rm } from 'fs/promises'
import { createReadStream } from 'fs'
import { inject, injectable } from '@joist/di'
import { Logger } from './Logger.js'

/**
 * FileSystem access
 * @throws {Error} all kinds of file system errors
 */
@injectable
export class FileSystem {
  #logger = inject(Logger)
  cwd = process.cwd()
  #path = ''

  async setupPath(p: string) {
    const isNew = await this.mkdir(p)
    this.#path = p
    return isNew
  }

  get path() {
    return this.#path
  }

  getAbsolutePath(folder: string) {
    return join(this.cwd, folder)
  }

  get absolutePath() {
    return join(this.cwd, this.path)
  }

  async mkdir(directory: string) {
    try {
      await mkdir(join(this.path, directory))
      this.#logger().log(`[Storage: ${this.path}/${directory}] Folder created`)
      return true
    } catch (error: any) {
      if (error?.code !== 'EEXIST') {
        throw error
      }
      return false
    }
  }

  async mkdirp(folders: string[]) {
    const p = join(this.path, ...folders)
    await mkdir(p, { recursive: true })
    this.#logger().log(`[Storage: ${p}] Folder created`)
  }

  async exists(name: string) {
    return stat(join(this.path, name))
      .then(() => true)
      .catch(() => undefined)
  }

  async list() {
    const list = await readdir(this.path)
    this.#logger().log('[Storage] List:\n °', list.join('\n ° '))
    return list
  }

  async read(name: string) {
    return readFile(join(this.path, name))
  }

  readStream(name: string) {
    const file = join(this.path, name)
    return createReadStream(file)
  }

  async save(name: string, source: Buffer) {
    await writeFile(join(this.path, name), source)
  }

  async delete(name: string) {
    return unlink(join(this.path, name))
  }

  async destroy() {
    await rm(this.path, { recursive: true })
    this.#logger().log(`[Storage: ${this.path}] Folder removed - destroyed`)
  }
}
