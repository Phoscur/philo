import {
  createReadStream,
  // createWriteStream,
} from 'fs'
import { stat, mkdir, readdir, readFile, writeFile, unlink } from 'fs/promises'
import { join } from 'path'
import getStorageStatus from './df'
import { Storage } from './Storage.interface'

/**
 * Filesystem access to cache photos for timelapses
 */
export class FileStorage implements Storage {
  protected constructor(public readonly path: string) {}

  static async create(path: string = 'storage'): Promise<FileStorage> {
    return new FileStorage(path).setup()
  }

  async setup() {
    try {
      await mkdir(this.path)
      console.log(`[Storage: ${this.path}] Folder created`)
    } catch (error: any) {
      if (error.code !== 'EEXIST') {
        throw error
      }
    }
    return this
  }

  async folder(name: string) {
    return FileStorage.create(join(this.path, name))
  }

  get cwd() {
    return join(process.cwd(), this.path)
  }

  async status() {
    const i = await getStorageStatus(this.cwd)
    //return `${i.folder}/${i.available} (${i.percent}: ${i.used}/${i.size}) [${this.path}]`
    return `${i.available} available (${i.percent} used ${i.used}/${i.size}) [${this.path}]`
  }

  async exists(name: string = '') {
    return stat(join(this.path, name))
      .then(() => join(process.cwd(), this.path, name))
      .catch(() => undefined)
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

  async add(name: string) {
    // add hook is not called by save here, but child classes (GlacierStorage) call this hook when saving
    console.log('FileStorage added (noop):', name)
  }

  async save(name: string, source: Buffer) {
    return writeFile(join(this.path, name), source)
  }

  async delete(name: string) {
    return unlink(join(this.path, name))
  }
}
