import {
  createReadStream,
  // createWriteStream,
} from 'fs'
import { stat, mkdir, readdir, readFile, writeFile, unlink, rm } from 'fs/promises'
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

  protected async setup() {
    if ('true' === process.env.GITHUB_ENABLED) {
      return this
    }
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

  get name(): string {
    return '' // fallback - overridden by subclasses
  }

  get cwd(): string {
    return join(process.cwd(), this.path)
  }

  async status() {
    const i = await getStorageStatus(this.cwd)
    const github = `Github Backup is ${
      process.env.GITHUB_ENABLED === 'true' ? 'enabled' : 'disabled'
    }.`
    const glacier = `Glacier Backup is ${
      process.env.AWS_GLACIER_ENABLED === 'true' ? 'enabled' : 'disabled'
    }.`
    return `[${this.path}]\n${i.available} available (${i.percent} used ${i.used}/${i.size}). ${github} ${glacier}`
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
    //add hook is not called by save here, but child classes (QueuedBackupStorage) call this hook when saving
    console.log('FileStorage added (noop):', name)
  }

  async processQueue() {
    console.log('FileStorage processQueue (noop)')
  }

  async save(name: string, source: Buffer) {
    await writeFile(join(this.path, name), source)
    // console.log('File written', name)
  }

  async delete(name: string) {
    return unlink(join(this.path, name))
  }

  async destroy() {
    await rm(this.path, { recursive: true })
    console.log(`[Storage: ${this.path}] Folder removed - destroyed`)
  }
}
