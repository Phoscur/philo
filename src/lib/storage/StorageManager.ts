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
  static async create(path = `${process.env.CONTENT_STORAGE_NAME}`) {
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
    return this.raw.path
  }

  saveRaw(name: string, buffer: Buffer) {
    return this.raw.save(name, buffer)
  }

  addMedia(name: string) {
    return this.media.add(name)
  }

  status() {
    return this.inventory.status()
  }

  // TODO? do we want to list or read raw image frames?
  list() {
    return this.media.list()
  }
  readStream(name: string) {
    return this.media.readStream(name)
  }
}
