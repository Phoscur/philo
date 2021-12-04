import {
  createReadStream,
  // createWriteStream,
} from 'fs'
import { stat, mkdir, readdir, readFile, writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import getStorageStatus from './df'

/**
 * Filesystem access to cache photos for timelapses
 */
export default class FileStorage {
  protected constructor(public readonly path: string) {}

  static async create(path: string = 'storage') {
    const storage = new FileStorage(path)
    await storage.setup()
    return storage
  }

  async setup() {
    if (!(await this.exists())) {
      await mkdir(this.path)
      console.log('Created storage folder:', this.path)
    }
  }

  get cwd() {
    return join(process.cwd(), this.path)
  }

  async status() {
    const i = await getStorageStatus(this.cwd)
    return `${i.folder}/${i.available} (${i.percent}: ${i.used}/${i.size}) [${this.path}]`
  }

  async exists(name: string = '') {
    return stat(join(this.path, name)).catch(() => false)
  }

  async list() {
    return readdir(this.path)
  }

  async read(name: string) {
    return readFile(join(this.path, name))
  }

  readStream(name: string) {
    const file = join(this.path, name)
    return createReadStream(file)
  }

  /* unused writeStream(name: string) {
    const file = join(this.path, name)
    return createWriteStream(file)
  } */

  async save(name: string, source: Buffer) {
    return writeFile(join(this.path, name), source)
  }

  async delete(name: string) {
    return unlink(join(this.path, name))
  }
}