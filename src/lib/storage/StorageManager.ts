import { join } from 'path'
import { DailyRotatingStorage, MonthlyRotatingStorage } from './RotatingStorage'
import { GithubStorage } from './GithubStorage'
import { Storage } from './Storage.interface'

// TODO TESTS!

/**
 * Saves raw pictures and produced/selected media seperately
 */
export class MediaBackupStorage {
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
  get rawCwd() {
    return ''
  }
  /**
   * Save existing media to videos
   */
  saveExisting() {}
  get mediaCwd() {
    return ''
  }
  get infoCwd() {
    return ''
  }

  // TODO save/provide infos.json alongside media with references to raw files
}

/**
 * Collect metadata and references,
 * manage multiple storage folders and types
 */
export class StorageManager {
  constructor(
    public readonly inventory: Storage,
    public readonly media: Storage,
    public readonly raw: Storage
  ) {}
  static async create(path = `${process.env.CONTENT_STORAGE_NAME}`) {
    const inventory = await GithubStorage.create(path)
    const raw = await DailyRotatingStorage.create(path) // path-YYYY-MM-DD
    const media = await MonthlyRotatingStorage.create(path) // path-YYYY-MM
    return new StorageManager(inventory, media, raw)
  }

  status() {
    return this.inventory.status()
  }
  list() {
    return ['TODO not implemented']
  }
  readStream(name: string) {
    return this.media.readStream(name)
  }
}
