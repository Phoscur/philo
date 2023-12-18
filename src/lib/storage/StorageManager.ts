// import { Storage } from './Storage.interface'
import { InventoryStorage } from './InventoryStorage'
import { DailyRotatingStorage, MonthlyRotatingStorage, RotatingStorage } from './RotatingStorage'

/**
 * Collect metadata and references inventory,
 * manage multiple storage folders and types
 * save raw pictures and produced/selected media seperately
 */
export class StorageManager {
  constructor(
    public readonly inventory: InventoryStorage,
    public readonly media: RotatingStorage,
    public readonly raw: RotatingStorage
  ) {}
  static async create(path = `${process.env.CONTENT_STORAGE_NAME_PREFIX}`) {
    const inventory = await InventoryStorage.create(path)

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

  async saveRaw(name: string, buffer: Buffer): Promise<void> {
    await this.raw.save(name, buffer)
    await this.inventory.addRaw(this.rawDirectory, name, this.raw.name)
  }
  async addMedia(name: string): Promise<void> {
    await this.media.add(name)
    await this.inventory.addMedia(this.mediaDirectory, name, this.media.name)
  }

  async processQueue() {
    await this.raw.processQueue()
    await this.media.processQueue()
    await this.inventory.processQueue()
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

  // TODO? inventory.status() should have all the info
  status(): Promise<string> {
    return this.raw.status()
  }

  // TODO? do we want to list or read raw image frames?
  list() {
    return this.media.list()
  }
}
