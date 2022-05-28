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
  constructor(public readonly content: GithubStorage) {}
  static async create(path = `${process.env.CONTENT_STORAGE_NAME}`) {
    const content = await GithubStorage.create(path)
    return new StorageManager(content)
  }

  get raw() {
    return this.content
  }
}
