import { join } from 'path'
import { PassThrough, Readable } from 'stream'
import { getFormattedDate } from '../time'
import { GithubStorage } from './GithubStorage'
import { Storage } from './Storage.interface'

// TODO TESTS!

/**
 * Saves raw pictures and produced/selected media seperately
 */
export default class MediaBackupStorage {
  protected constructor(public readonly raw: GithubStorage, public readonly media: GithubStorage) {}

  static async create(path = `${process.env.MEDIA_STORAGE_NAME}`) {
    const raw = await GithubStorage.create(path + '-raw')
    const media = await GithubStorage.create(path)
    return new MediaBackupStorage(raw, media)
  }

  /**
   * Save raw image buffer data
   */
  saveRaw() {}
  /**
   * Save existing media to videos
   */
  saveExisting() {}

  // TODO save/provide infos.json alongside media with references to raw files
}

class ProxyStorage implements Storage {
  protected constructor(public path: string, protected data?: Storage) {}

  static async create(path: string, data: Storage) {
    return new ProxyStorage(path, data)
  }

  async getData(): Promise<Storage> {
    if (!this.data) throw new Error('Proxy forwarding failure: data is not set')
    return this.data
  }

  get cwd() {
    return join(process.cwd(), this.path)
  }
  async status() {
    const proxy = await this.getData()
    return proxy.status()
  }
  async list() {
    const proxy = await this.getData()
    return proxy.list()
  }
  async exists(name?: string) {
    const proxy = await this.getData()
    return proxy.exists(name)
  }
  async read(name: string) {
    const proxy = await this.getData()
    return proxy.read(name)
  }
  readStream(name: string): Readable {
    const stream = new PassThrough()
    this.getData().then((proxy) => proxy.readStream(name).pipe(stream))
    return stream
  }
  async add(name: string) {
    const proxy = await this.getData()
    return proxy.add(name)
  }
  async save(name: string, source: Buffer) {
    const proxy = await this.getData()
    return proxy.save(name, source)
  }
  async delete(name: string) {
    const proxy = await this.getData()
    return proxy.delete(name)
  }
}
/**
 * Daily Backups (GithubStorage)
 * TODO! free disk space afterwards!
 */
export class DailyRotatingStorage extends ProxyStorage {
  public path = ''
  protected constructor(public pathPrefix: string, protected data?: Storage) {
    super('', data)
  }

  static async create(path = `${process.env.GITHUB_REPO_NAME_PREFIX}`) {
    return await new DailyRotatingStorage(path).rotate()
  }

  async rotate() {
    const { folderDayFormatted } = await getFormattedDate()
    if (this.data && ~this.data.path.indexOf(folderDayFormatted)) {
      // fresh enough
      return this
    }
    if (this.data) {
      console.log('TODO delete old data', this.data.path)
    }
    this.path = `${this.pathPrefix}-${folderDayFormatted}`
    console.log('Storage rotated', this.path)
    this.data = await GithubStorage.create(this.path)
    return this
  }

  /**
   * Get storage, rotated as necessary
   */
  async getData() {
    await this.rotate()
    const data = await super.getData()
    return data
  }
}

/**
 * Collect metadata and references,
 * manage multiple storage folders and types
 */
export class StorageManager {
  constructor(public readonly content: GithubStorage) {}
  static async create(path = `${process.env.CONTENT_STORAGE_NAME}`) {
    const content = await GithubStorage.create(path)
    return new StorageManager(content)
  }
}
