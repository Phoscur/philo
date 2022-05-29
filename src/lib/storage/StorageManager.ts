import { DailyRotatingStorage, MonthlyRotatingStorage } from './RotatingStorage'
import { GithubStorage } from './GithubStorage'
import { Storage } from './Storage.interface'

/**
 * Collect metadata and references inventory,
 * manage multiple storage folders and types
 * save raw pictures and produced/selected media seperately
 */
export class StorageManager {
  constructor(
    public readonly inventory: Storage,
    public readonly media: Storage,
    public readonly raw: Storage
  ) {}
  static async create(path = `${process.env.CONTENT_STORAGE_NAME_PREFIX}`) {
    // TODO save/provide infos.json alongside media with references to raw files
    const inventory = await GithubStorage.create(path)

    const raw = await DailyRotatingStorage.create(path) // name=$path-YYYY-MM-DD
    const media = await MonthlyRotatingStorage.create(path) // name=$path-YYYY-MM
    return new StorageManager(inventory, media, raw)
  }

  get workingDirectory() {
    return process.cwd()
  }

  get rawDirectory() {
    return this.raw.path
  }
  get mediaDirectory() {
    return this.media.path
  }

  saveRaw(name: string, buffer: Buffer): Promise<void> {
    return this.raw.save(name, buffer)
  }

  addMedia(name: string): Promise<void> {
    return this.media.add(name)
  }

  async exists(name: string = '') {
    // TODO handle this better
    const nameWithoutPathPrefix = name.replace(this.media.path + '/', '')
    return this.media.exists(nameWithoutPathPrefix)
  }

  readStream(name: string) {
    // TODO handle this better
    const nameWithoutPathPrefix = name.replace(this.media.path + '/', '')
    return this.media.readStream(nameWithoutPathPrefix)
  }

  status(): Promise<string> {
    return this.inventory.status()
  }

  // TODO? do we want to list or read raw image frames?
  list() {
    return this.media.list()
  }
}
